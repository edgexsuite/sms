import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Search, Save, Users, AlertCircle, ArrowLeft, Loader2, CheckCircle2, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { PageHeader, Card, Btn, Input, EmptyState } from '../../components/ui';

interface StudentRow {
  id: string;
  full_name: string;
  roll_number: string;
  class_id: string;
  class_name: string;
  class_section: string;
  current_arrears: number;
  new_arrears: number;
  is_dirty: boolean;
  already_has_migration: boolean;
}

export default function BulkArrearsEntry() {
  const { userRole } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selectedClass, setSelectedClass] = useState('all');
  const [search, setSearch] = useState('');

  // Migration month: default to last month (arrears are typically from before this period)
  const [migrationMonth, setMigrationMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  });

  useEffect(() => {
    if (userRole?.school_id) fetchInitialData();
  }, [userRole?.school_id]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: clsData } = await supabase
        .from('classes')
        .select('id, name, section')
        .eq('school_id', userRole?.school_id)
        .order('name');
      setClasses(clsData || []);

      const { data: stuData } = await supabase
        .from('students')
        .select('id, full_name, roll_number, class_id, classes(name, section)')
        .eq('school_id', userRole?.school_id)
        .eq('status', 'active')
        .order('class_id');

      // Fetch MIG invoices — filter soft-deletes so display is consistent
      const { data: invData } = await supabase
        .from('fee_records')
        .select('student_id, total_amount, invoice_number')
        .eq('school_id', userRole?.school_id)
        .ilike('invoice_number', 'MIG-%')
        .is('deleted_at', null);

      if (stuData) {
        const rows: StudentRow[] = stuData.map(s => {
          const migInv = invData?.find(i => i.student_id === s.id);
          const currentAmt = migInv ? Number(migInv.total_amount) : 0;
          return {
            id: s.id,
            full_name: s.full_name,
            roll_number: s.roll_number,
            class_id: s.class_id,
            class_name: (s.classes as any)?.name || 'No Class',
            class_section: (s.classes as any)?.section || '',
            current_arrears: currentAmt,
            new_arrears: currentAmt,
            is_dirty: false,
            already_has_migration: !!migInv,
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

  const handleArrearsChange = (id: string, value: string) => {
    const amt = parseInt(value) || 0;
    setStudents(prev => prev.map(s =>
      s.id === id ? { ...s, new_arrears: amt, is_dirty: amt !== s.current_arrears } : s
    ));
  };

  const handleSave = async () => {
    const dirtyRows = students.filter(s => s.is_dirty);
    if (dirtyRows.length === 0) return;

    setSaving(true);
    const monthYear = migrationMonth + '-01';

    try {
      for (const s of dirtyRows) {
        if (s.new_arrears === 0 && s.already_has_migration) {
          // Soft-delete (not hard) to preserve audit trail.
          // All queries filter by is('deleted_at', null) so this disappears from all views.
          await supabase
            .from('fee_records')
            .update({ deleted_at: new Date().toISOString() })
            .eq('student_id', s.id)
            .ilike('invoice_number', 'MIG-%')
            .is('deleted_at', null);
        } else if (s.new_arrears > 0) {
          if (s.already_has_migration) {
            // BUG FIX #3: Update month_year too (not just amount/breakdown)
            await supabase
              .from('fee_records')
              .update({
                total_amount: s.new_arrears,
                month_year: monthYear,           // ← was missing
                breakdown: [{ item: 'Opening Balance (Migrated)', amount: s.new_arrears }],
              })
              .eq('student_id', s.id)
              .ilike('invoice_number', 'MIG-%')
              .is('deleted_at', null);
          } else {
            // BUG FIX #1: Use student UUID prefix — roll numbers collide across classes
            const invNum = `MIG-${s.id.slice(0, 8).toUpperCase()}`;

            await supabase.from('fee_records').insert({
              school_id: userRole?.school_id,
              student_id: s.id,
              student_name: s.full_name,         // BUG FIX #2: store name directly
              month_year: monthYear,
              total_amount: s.new_arrears,
              discount_amount: 0,
              paid_amount: 0,
              status: 'pending',
              invoice_number: invNum,
              payment_mode: 'Pending',
              remarks: 'Migrated arrears from previous portal',
              breakdown: [{ item: 'Opening Balance (Migrated)', amount: s.new_arrears }],
            });
          }
        }
      }

      setSaveMsg(`${dirtyRows.length} record${dirtyRows.length > 1 ? 's' : ''} saved`);
      setTimeout(() => setSaveMsg(''), 3000);
      await fetchInitialData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students.filter(s => {
    const q = search.toLowerCase();
    return (
      (selectedClass === 'all' || s.class_id === selectedClass) &&
      (s.full_name.toLowerCase().includes(q) || String(s.roll_number).includes(q))
    );
  });

  const dirtyCount = students.filter(s => s.is_dirty).length;
  const totalMigrated = students.reduce((sum, s) => sum + s.current_arrears, 0);
  const migratedCount = students.filter(s => s.already_has_migration).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader 
        title="Bulk Arrears Entry" 
        subtitle="Opening balance migration from previous portal"
        icon={History}
        onBack={() => navigate(-1)}
        actions={
          <div className="flex items-center gap-2">
            {saveMsg && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
                ✓ {saveMsg}
              </span>
            )}
            {dirtyCount > 0 && (
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                {dirtyCount} unsaved
              </span>
            )}
            <Btn
              onClick={handleSave}
              disabled={saving || dirtyCount === 0}
              variant={dirtyCount > 0 ? 'primary' : 'secondary'}
              icon={saving ? undefined : Save}
              loading={saving}
            >
              Save{dirtyCount > 0 ? ` (${dirtyCount})` : ''}
            </Btn>
          </div>
        }
      />

      <Card className="p-4 flex flex-wrap items-center gap-3 border-b border-slate-100">
        <div className="max-w-sm w-full">
          <Input
            icon={Search}
            type="text"
            placeholder="Search by name or roll…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          value={selectedClass}
          onChange={e => setSelectedClass(e.target.value)}
          className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
        >
          <option value="all">All Classes</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name} {c.section}</option>
          ))}
        </select>
        <div className="flex items-center gap-1.5 border border-amber-200 bg-amber-50/50 rounded-xl px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-[13px] font-medium text-amber-700 whitespace-nowrap">Arrears month:</span>
          <input
            type="month"
            value={migrationMonth}
            onChange={e => setMigrationMonth(e.target.value)}
            className="bg-transparent border-none p-0 text-[13px] font-bold text-amber-700 focus:ring-0 outline-none cursor-pointer"
          />
        </div>
      </Card>

      {/* ── Info banner ── */}
      <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl px-5 py-3 text-[13px] text-indigo-800 space-y-1 shadow-sm">
        <p>
          <strong>How it works:</strong> Each entry creates a <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-100 text-xs shadow-sm">MIG-</code> pending invoice for the selected month. It appears as <strong>"Previous Fee"</strong> on monthly challans and as an <strong>arrears row</strong> in the payment modal. Set to 0 and save to soft-delete a migration record (recoverable from Settings → Trash Bin).
        </p>
        {migratedCount > 0 && (
          <p className="text-emerald-700 font-medium pt-1">
            ✓ {migratedCount} students migrated · Total: Rs. {totalMigrated.toLocaleString()}
          </p>
        )}
      </div>

      {/* ── Table ── */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[520px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 w-12">#</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3 hidden sm:table-cell">Class</th>
                <th className="px-4 py-3 text-center w-40">Opening Arrears (Rs.)</th>
                <th className="px-4 py-3 text-right w-28">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-slate-400">
                    <EmptyState icon="Users" title="No students found" sub="Adjust your filters or search." />
                  </td>
                </tr>
              ) : (
                filteredStudents.map(s => (
                  <tr
                    key={s.id}
                    className={cn(
                      'hover:bg-slate-50 transition-colors',
                      s.is_dirty ? 'bg-amber-50/30' : ''
                    )}
                  >
                    <td className="px-4 py-3 text-xs text-slate-400 font-medium">{s.roll_number}</td>

                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 text-sm">{s.full_name}</p>
                      <p className="text-xs text-slate-500 sm:hidden mt-0.5">{s.class_name} {s.class_section}</p>
                      {s.is_dirty && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 mt-1 uppercase tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
                          unsaved
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="inline-flex px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600">
                        {s.class_name} {s.class_section}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="relative w-full max-w-[130px] mx-auto">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 pointer-events-none">Rs.</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={s.new_arrears || ''}
                          onFocus={e => e.target.select()}
                          onChange={e => handleArrearsChange(s.id, e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="0"
                          className={cn(
                            'w-full pl-9 pr-3 py-2 rounded-xl text-[13px] font-bold text-center transition-all outline-none',
                            s.is_dirty
                              ? 'bg-white border border-amber-300 ring-2 ring-amber-500/20 text-amber-900'
                              : 'bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900'
                          )}
                        />
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right">
                      {s.is_dirty ? (
                        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">unsaved</span>
                      ) : s.already_has_migration ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md uppercase tracking-wider">
                          <CheckCircle2 className="w-3.5 h-3.5" /> migrated
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredStudents.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} shown</span>
            {dirtyCount > 0 && (
              <span className="text-amber-600 font-bold">{dirtyCount} pending save</span>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
