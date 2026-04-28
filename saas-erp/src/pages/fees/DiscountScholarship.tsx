import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Tag, Plus, Trash2, Search, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';
import HelpBanner from '../../components/HelpBanner';

interface DiscountRule {
  id: string;
  name: string;
  type: 'percentage' | 'flat';
  value: number;
  description: string;
}

interface StudentDiscount {
  id: string;
  student_id: string;
  rule_id: string;
  student_name: string;
  roll_number: number;
  class_name: string;
  rule_name: string;
  discount_value: string;
  effective_waiver_pct: number;
}

/** Sum all percentage rules (cap 100%). Flat rules do not affect fee_waiver_percentage. */
const computeWaiverPct = (ruleIds: string[], allRules: DiscountRule[]): number => {
  let total = 0;
  ruleIds.forEach(rid => {
    const rule = allRules.find(r => r.id === rid);
    if (rule?.type === 'percentage') total += rule.value;
  });
  return Math.min(Math.round(total), 100);
};

export default function DiscountScholarship() {
  const { userRole } = useAuth();
  const [rules, setRules] = useState<DiscountRule[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'rules' | 'students'>('rules');
  const [search, setSearch] = useState('');
  const [isRuleModal, setIsRuleModal] = useState(false);
  const [isAssignModal, setIsAssignModal] = useState(false);
  const [ruleForm, setRuleForm] = useState({ name: '', type: 'percentage' as 'percentage' | 'flat', value: '', description: '' });
  const [assignForm, setAssignForm] = useState({ student_id: '', rule_id: '' });
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) { fetchRules(); fetchStudents(); }
  }, [userRole]);

  const fetchRules = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('form_settings')
      .select('sections_config')
      .eq('school_id', userRole!.school_id)
      .eq('form_name', 'discount_rules')
      .maybeSingle();
    setRules(data?.sections_config?.rules ?? []);
    setLoading(false);
  };

  const fetchStudents = async () => {
    const { data } = await supabase
      .from('students')
      .select('id, full_name, roll_number, custom_data, fee_waiver_percentage, class:class_id(name, section)')
      .eq('school_id', userRole!.school_id)
      .eq('status', 'active')
      .order('full_name');
    setStudents(data || []);
  };

  /** Build the flat assignment list from students.custom_data */
  const assignments = useMemo<StudentDiscount[]>(() => {
    const result: StudentDiscount[] = [];
    students.forEach(s => {
      const ruleIds: string[] = s.custom_data?.discount_rule_ids || [];
      const effectivePct = computeWaiverPct(ruleIds, rules);
      ruleIds.forEach(rid => {
        const rule = rules.find(r => r.id === rid);
        if (rule) result.push({
          id: `${s.id}-${rid}`,
          student_id: s.id,
          rule_id: rid,
          student_name: s.full_name,
          roll_number: s.roll_number,
          class_name: s.class ? `${s.class.name}-${s.class.section}` : '-',
          rule_name: rule.name,
          discount_value: rule.type === 'percentage' ? `${rule.value}%` : `Rs. ${rule.value}`,
          effective_waiver_pct: effectivePct,
        });
      });
    });
    return result;
  }, [rules, students]);

  const filteredAssignments = assignments.filter(a =>
    a.student_name.toLowerCase().includes(search.toLowerCase()) || String(a.roll_number).includes(search)
  );

  const persistRules = async (updated: DiscountRule[]) => {
    await supabase.from('form_settings').upsert(
      { school_id: userRole!.school_id, form_name: 'discount_rules', sections_config: { rules: updated } },
      { onConflict: 'school_id,form_name' }
    );
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = [...rules, {
      id: crypto.randomUUID(),
      name: ruleForm.name.trim(),
      type: ruleForm.type,
      value: parseFloat(ruleForm.value) || 0,
      description: ruleForm.description.trim(),
    }];
    setRules(updated);
    await persistRules(updated);
    setIsRuleModal(false);
    setRuleForm({ name: '', type: 'percentage', value: '', description: '' });
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Delete this rule? Any students assigned to it will lose this discount.')) return;
    const updated = rules.filter(r => r.id !== id);
    setRules(updated);
    await persistRules(updated);
    // Recalculate waiver for all students that had this rule
    const affected = students.filter(s => (s.custom_data?.discount_rule_ids || []).includes(id));
    await Promise.all(affected.map(async s => {
      const newIds = (s.custom_data?.discount_rule_ids || []).filter((rid: string) => rid !== id);
      const newPct = computeWaiverPct(newIds, updated);
      await supabase.from('students').update({
        custom_data: { ...s.custom_data, discount_rule_ids: newIds },
        fee_waiver_percentage: newPct,
      }).eq('id', s.id);
    }));
    await fetchStudents();
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    const student = students.find(s => s.id === assignForm.student_id);
    if (!student) return;
    const existingIds: string[] = student.custom_data?.discount_rule_ids || [];
    if (existingIds.includes(assignForm.rule_id)) { setIsAssignModal(false); return; }

    setAssigning(true);
    const updatedIds = [...existingIds, assignForm.rule_id];
    const newPct = computeWaiverPct(updatedIds, rules);

    await supabase.from('students').update({
      custom_data: { ...student.custom_data, discount_rule_ids: updatedIds },
      fee_waiver_percentage: newPct,
    }).eq('id', student.id);

    await fetchStudents();
    setAssigning(false);
    setIsAssignModal(false);
    setAssignForm({ student_id: '', rule_id: '' });
  };

  const handleRemoveAssignment = async (studentId: string, ruleId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const updatedIds = (student.custom_data?.discount_rule_ids || []).filter((id: string) => id !== ruleId);
    const newPct = computeWaiverPct(updatedIds, rules);
    await supabase.from('students').update({
      custom_data: { ...student.custom_data, discount_rule_ids: updatedIds },
      fee_waiver_percentage: newPct,
    }).eq('id', student.id);
    await fetchStudents();
  };

  // Preview: what waiver % will the selected student have after assigning the rule?
  const assignPreview = useMemo(() => {
    if (!assignForm.student_id || !assignForm.rule_id) return null;
    const student = students.find(s => s.id === assignForm.student_id);
    if (!student) return null;
    const existingIds: string[] = student.custom_data?.discount_rule_ids || [];
    const newIds = existingIds.includes(assignForm.rule_id)
      ? existingIds
      : [...existingIds, assignForm.rule_id];
    const pct = computeWaiverPct(newIds, rules);
    const selectedRule = rules.find(r => r.id === assignForm.rule_id);
    const isFlat = selectedRule?.type === 'flat';
    return { pct, isFlat, currentPct: student.fee_waiver_percentage || 0 };
  }, [assignForm, students, rules]);

  return (
    <div className="space-y-6">

      <HelpBanner
        storageKey="help_discounts"
        title="How Discounts & Scholarships work"
        color="emerald"
        steps={[
          'Go to "Discount Rules" tab → click "Add Discount Rule" to create a named rule (e.g. "Siblings Discount — 10%" or "Merit Scholarship — 25%").',
          'Go to "Student Assignments" tab → click "Assign Discount" to link a rule to a specific student.',
          'The student\'s Fee Waiver % is updated automatically — future invoices generated for that student will have the discount applied.',
          'Remove an assignment here if the student no longer qualifies — the waiver % is recalculated automatically.',
        ]}
        tip='Flat amount discounts are recorded but must be applied manually as invoice adjustments. Percentage discounts apply automatically to all future generated invoices.'
      />

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="w-6 h-6 text-emerald-600" /> Discounts & Scholarships
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage fee discount rules and assign them to students. Percentage discounts automatically apply to future generated invoices.
          </p>
        </div>
        <button
          onClick={() => tab === 'rules' ? setIsRuleModal(true) : setIsAssignModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4" /> {tab === 'rules' ? 'Add Discount Rule' : 'Assign Discount'}
        </button>
      </div>

      <div className="flex border-b border-gray-200">
        {(['rules', 'students'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'rules' ? `Discount Rules (${rules.length})` : `Student Assignments (${assignments.length})`}
          </button>
        ))}
      </div>

      {/* ── Discount Rules Tab ──────────────────────────────────────── */}
      {tab === 'rules' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? <div className="p-12 text-center text-gray-400">Loading...</div>
            : rules.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Tag className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p>No discount rules yet.</p>
                <p className="text-xs mt-1">Create rules like "Siblings Discount 10%" or "Merit Scholarship 25%".</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Rule Name</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Type</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Value</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Effect on Invoices</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Description</th>
                    <th className="px-6 py-3 text-right font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rules.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{r.name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${r.type === 'percentage' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                          {r.type === 'percentage' ? 'Percentage' : 'Flat Amount'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-gray-900">
                        {r.type === 'percentage' ? `${r.value}% off` : `Rs. ${r.value} off`}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {r.type === 'percentage' ? (
                          <span className="flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Auto-applied to generated invoices
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-600">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Manual — apply as invoice adjustment
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500">{r.description || '-'}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDeleteRule(r.id)} className="text-red-500 hover:text-red-700 p-1" title="Delete rule">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      )}

      {/* ── Student Assignments Tab ─────────────────────────────────── */}
      {tab === 'students' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="Search students..." />
            </div>
            <button onClick={() => exportToCSV('discount-assignments', filteredAssignments, [
              { header: 'Student', key: 'student_name' }, { header: 'Roll No', key: 'roll_number' },
              { header: 'Class', key: 'class_name' }, { header: 'Discount', key: 'rule_name' },
              { header: 'Value', key: 'discount_value' }, { header: 'Effective Waiver %', key: 'effective_waiver_pct' },
            ])} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
            {filteredAssignments.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Tag className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p>No discount assignments yet.</p>
                <p className="text-xs mt-1">Use "Assign Discount" to link rules to students.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Student</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Class</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Discount Rule</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Value</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Effective Waiver</th>
                    <th className="px-6 py-3 text-right font-medium text-gray-500">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredAssignments.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{a.student_name}</p>
                        <p className="text-xs text-gray-400">Roll #{a.roll_number}</p>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{a.class_name}</td>
                      <td className="px-6 py-4 font-medium text-emerald-700">{a.rule_name}</td>
                      <td className="px-6 py-4 font-mono text-gray-900">{a.discount_value}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          {a.effective_waiver_pct}% waiver active
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleRemoveAssignment(a.student_id, a.rule_id)}
                          className="text-red-500 hover:text-red-700 p-1" title="Remove this discount">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Add Rule Modal ──────────────────────────────────────────── */}
      {isRuleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Add Discount Rule</h2>
              <button onClick={() => setIsRuleModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleAddRule} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
                <input required value={ruleForm.name} onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. Siblings Discount, Merit Scholarship" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select value={ruleForm.type} onChange={e => setRuleForm({ ...ruleForm, type: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500">
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (Rs.)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value ({ruleForm.type === 'percentage' ? '%' : 'Rs.'})
                  </label>
                  <input required type="text" inputMode="decimal" value={ruleForm.value}
                    onFocus={e => e.target.select()}
                    onChange={e => setRuleForm({ ...ruleForm, value: e.target.value.replace(/[^0-9.]/g, '') })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                    placeholder={ruleForm.type === 'percentage' ? '10' : '500'} />
                </div>
              </div>
              {ruleForm.type === 'percentage' && parseFloat(ruleForm.value) > 0 && (
                <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                  ✓ This {ruleForm.value}% discount will automatically apply to generated invoices for assigned students.
                </p>
              )}
              {ruleForm.type === 'flat' && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  ⚠ Flat amount discounts are for record-keeping. Apply them manually when editing individual invoices.
                </p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input value={ruleForm.description} onChange={e => setRuleForm({ ...ruleForm, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. For students with 2+ siblings enrolled" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsRuleModal(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                  Add Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Assign Discount Modal ───────────────────────────────────── */}
      {isAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold">Assign Discount to Student</h2>
                <p className="text-xs text-gray-400 mt-0.5">Percentage discounts update the student's fee waiver automatically.</p>
              </div>
              <button onClick={() => setIsAssignModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleAssign} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
                <select required value={assignForm.student_id}
                  onChange={e => setAssignForm({ ...assignForm, student_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500">
                  <option value="">Select student...</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} — Roll #{s.roll_number}
                      {(s.fee_waiver_percentage || 0) > 0 ? ` (${s.fee_waiver_percentage}% waiver)` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount Rule</label>
                <select required value={assignForm.rule_id}
                  onChange={e => setAssignForm({ ...assignForm, rule_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500">
                  <option value="">Select rule...</option>
                  {rules.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {r.type === 'percentage' ? `${r.value}%` : `Rs. ${r.value}`} ({r.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Live preview of what will happen */}
              {assignPreview && (
                <div className={`rounded-xl p-4 text-sm border ${assignPreview.isFlat ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                  {assignPreview.isFlat ? (
                    <div className="flex items-start gap-2 text-amber-800">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Flat discount — manual application</p>
                        <p className="text-xs mt-0.5">This will be recorded on the student's profile but won't automatically reduce generated invoices. Apply it when editing individual invoices.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Fee Waiver will be set to {assignPreview.pct}%</p>
                        <p className="text-xs mt-0.5">
                          {assignPreview.currentPct > 0
                            ? `Currently ${assignPreview.currentPct}% → will become ${assignPreview.pct}% after this assignment.`
                            : `All future generated invoices for this student will be discounted by ${assignPreview.pct}%.`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsAssignModal(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={assigning}
                  className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                  {assigning ? 'Assigning...' : 'Assign Discount'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
