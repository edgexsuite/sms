import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Search, Save, ArrowLeft, Loader2, Tag } from 'lucide-react';
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
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    if (userRole?.school_id) fetchData();
  }, [userRole?.school_id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: clsData } = await supabase
        .from('classes')
        .select('id, name, section')
        .eq('school_id', userRole?.school_id)
        .order('name');
      setClasses(clsData || []);

      const { data: fsData } = await supabase
        .from('fee_structures')
        .select('class_id, amount, fee_matrix')
        .eq('school_id', userRole?.school_id);

      const { data: stuData } = await supabase
        .from('students')
        .select('id, full_name, roll_number, class_id, fee_waiver_percentage, classes(name, section)')
        .eq('school_id', userRole?.school_id)
        .eq('status', 'active')
        .order('class_id');

      if (stuData) {
        const rows: StudentRow[] = stuData.map(s => {
          const structure = fsData?.find(f => f.class_id === s.class_id);
          let tuition = 0;
          if (structure) {
            const matrix = structure.fee_matrix;
            if (matrix?.recurrent?.length) {
              tuition = matrix.recurrent.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
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
            class_name: (s.classes as any)?.name || 'No Class',
            class_section: (s.classes as any)?.section || '',
            fee_waiver_percentage: s.fee_waiver_percentage || 0,
            tuition_fee: tuition,
            current_discount_amount: currentDiscount,
            new_discount_amount: currentDiscount,
            is_dirty: false,
          };
        });
        rows.sort((a, b) => {
          const c = a.class_name.localeCompare(b.class_name);
          return c !== 0 ? c : (parseInt(a.roll_number) || 0) - (parseInt(b.roll_number) || 0);
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
    setStudents(prev => prev.map(s =>
      s.id === id ? { ...s, new_discount_amount: amt, is_dirty: amt !== s.current_discount_amount } : s
    ));
  };

  const handleSave = async () => {
    const dirtyRows = students.filter(s => s.is_dirty);
    if (dirtyRows.length === 0) return;
    setSaving(true);
    try {
      const updates = dirtyRows.map(s => {
        const pct = s.tuition_fee > 0
          ? Math.min(100, Math.round((s.new_discount_amount / s.tuition_fee) * 10000) / 100)
          : 0;
        return supabase.from('students').update({ fee_waiver_percentage: pct }).eq('id', s.id);
      });
      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        alert(`Failed to save some records: ${errors[0].error?.message}`);
      } else {
        setSaveMsg(`${dirtyRows.length} student${dirtyRows.length > 1 ? 's' : ''} saved`);
        setTimeout(() => setSaveMsg(''), 3000);
        setStudents(prev => prev.map(s => ({
          ...s,
          current_discount_amount: s.new_discount_amount,
          fee_waiver_percentage: s.tuition_fee > 0
            ? Math.min(100, Math.round((s.new_discount_amount / s.tuition_fee) * 10000) / 100)
            : s.fee_waiver_percentage,
          is_dirty: false,
        })));
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students.filter(s => {
    const q = search.toLowerCase();
    return (
      (classFilter === 'all' || s.class_id === classFilter) &&
      (s.full_name.toLowerCase().includes(q) || String(s.roll_number).includes(q))
    );
  });

  const dirtyCount = students.filter(s => s.is_dirty).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
        {/* Row 1: title + save */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-gray-500" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-gray-900 leading-tight">Bulk Discount Manager</h1>
              <p className="text-xs text-gray-400 leading-tight hidden sm:block">Set monthly discount per student</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {saveMsg && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg">
                ✓ {saveMsg}
              </span>
            )}
            {dirtyCount > 0 && (
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                <Tag className="w-3 h-3" />
                {dirtyCount} unsaved
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || dirtyCount === 0}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                dirtyCount > 0
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              )}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save{dirtyCount > 0 ? ` (${dirtyCount})` : ''}
            </button>
          </div>
        </div>

        {/* Row 2: filters */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or roll…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
            />
          </div>
          <select
            value={classFilter}
            onChange={e => setClassFilter(e.target.value)}
            className="flex-shrink-0 border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="all">All Classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name} {c.section}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Info banner ── */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-xs text-blue-700">
        <strong>How it works:</strong> Enter the flat discount amount per student. The system converts it to a
        percentage of their total monthly fee and stores it. Regenerate invoices after saving for the new
        discount to take effect.
      </div>

      {/* ── Table ── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[560px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 w-12">#</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Student</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">Class</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">Monthly Fee</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 w-36">Discount (Rs.)</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">Net Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-gray-400">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">No students found</p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map(s => {
                  const netFee = s.tuition_fee - s.new_discount_amount;
                  const waiverPct = s.tuition_fee > 0
                    ? (Math.min(100, Math.round((s.new_discount_amount / s.tuition_fee) * 10000) / 100))
                      .toFixed(2).replace(/\.00$/, '')
                    : '0';
                  return (
                    <tr
                      key={s.id}
                      className={cn(
                        'hover:bg-gray-50 transition-colors',
                        s.is_dirty ? 'bg-amber-50/60' : ''
                      )}
                    >
                      {/* Roll # */}
                      <td className="px-3 py-2.5 text-xs text-gray-400 font-medium">
                        {s.roll_number}
                      </td>

                      {/* Name */}
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-gray-800 text-sm leading-tight">{s.full_name}</p>
                        {/* class shown here on mobile */}
                        <p className="text-xs text-gray-400 sm:hidden mt-0.5">{s.class_name} {s.class_section}</p>
                        {s.is_dirty && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
                            unsaved
                          </span>
                        )}
                      </td>

                      {/* Class (desktop only) */}
                      <td className="px-3 py-2.5 hidden sm:table-cell">
                        <span className="inline-flex px-2 py-0.5 rounded-md bg-gray-100 text-xs font-medium text-gray-600">
                          {s.class_name} {s.class_section}
                        </span>
                      </td>

                      {/* Monthly Fee */}
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-sm font-medium text-gray-600">
                          {s.tuition_fee > 0 ? `Rs. ${s.tuition_fee.toLocaleString()}` : '—'}
                        </span>
                      </td>

                      {/* Discount Input */}
                      <td className="px-3 py-2.5">
                        <div className="relative w-full max-w-[130px] mx-auto">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">Rs.</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={s.new_discount_amount || ''}
                            onFocus={e => e.target.select()}
                            onChange={e => handleDiscountChange(s.id, e.target.value.replace(/[^0-9]/g, ''))}
                            placeholder="0"
                            className={cn(
                              'w-full pl-8 pr-2 py-1.5 rounded-lg text-sm font-semibold text-center transition-all outline-none',
                              s.is_dirty
                                ? 'bg-white border-2 border-amber-400 ring-2 ring-amber-100'
                                : 'bg-gray-50 border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
                            )}
                          />
                        </div>
                      </td>

                      {/* Net Fee */}
                      <td className="px-3 py-2.5 text-right">
                        <p className={cn(
                          'text-sm font-bold leading-tight',
                          netFee <= 0 ? 'text-emerald-600' : 'text-gray-900'
                        )}>
                          Rs. {netFee.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-gray-400">{waiverPct}% off</p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer summary */}
        {filteredStudents.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
            <span>{filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} shown</span>
            {dirtyCount > 0 && (
              <span className="text-amber-600 font-semibold">{dirtyCount} pending save</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
