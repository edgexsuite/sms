import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Tag, Plus, Trash2, Search, Download } from 'lucide-react';
import { exportToCSV } from '../../lib/exportUtils';

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
}

export default function DiscountScholarship() {
  const { userRole } = useAuth();
  const [rules, setRules] = useState<DiscountRule[]>([]);
  const [assignments, setAssignments] = useState<StudentDiscount[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'rules' | 'students'>('rules');
  const [search, setSearch] = useState('');
  const [isRuleModal, setIsRuleModal] = useState(false);
  const [isAssignModal, setIsAssignModal] = useState(false);
  const [ruleForm, setRuleForm] = useState({ name: '', type: 'percentage' as 'percentage' | 'flat', value: '', description: '' });
  const [assignForm, setAssignForm] = useState({ student_id: '', rule_id: '' });

  useEffect(() => {
    if (userRole?.school_id) { fetchRules(); fetchStudents(); }
  }, [userRole]);

  useEffect(() => {
    if (rules.length > 0 && students.length > 0) buildAssignments();
  }, [rules, students]);

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
      .select('id, full_name, roll_number, custom_data, class:class_id(name, section)')
      .eq('school_id', userRole!.school_id)
      .eq('status', 'active')
      .order('full_name');
    setStudents(data || []);
  };

  const buildAssignments = () => {
    const result: StudentDiscount[] = [];
    students.forEach(s => {
      const discounts: string[] = s.custom_data?.discount_rule_ids || [];
      discounts.forEach(ruleId => {
        const rule = rules.find(r => r.id === ruleId);
        if (rule) result.push({
          id: `${s.id}-${ruleId}`,
          student_id: s.id,
          rule_id: ruleId,
          student_name: s.full_name,
          roll_number: s.roll_number,
          class_name: s.class ? `${s.class.name}-${s.class.section}` : '-',
          rule_name: rule.name,
          discount_value: rule.type === 'percentage' ? `${rule.value}%` : `Rs. ${rule.value}`,
        });
      });
    });
    setAssignments(result);
  };

  const persistRules = async (updated: DiscountRule[]) => {
    await supabase.from('form_settings').upsert(
      { school_id: userRole!.school_id, form_name: 'discount_rules', sections_config: { rules: updated } },
      { onConflict: 'school_id,form_name' }
    );
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = [...rules, { id: crypto.randomUUID(), name: ruleForm.name.trim(), type: ruleForm.type, value: parseFloat(ruleForm.value) || 0, description: ruleForm.description.trim() }];
    setRules(updated);
    await persistRules(updated);
    setIsRuleModal(false);
    setRuleForm({ name: '', type: 'percentage', value: '', description: '' });
  };

  const handleDeleteRule = async (id: string) => {
    const updated = rules.filter(r => r.id !== id);
    setRules(updated);
    await persistRules(updated);
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    const student = students.find(s => s.id === assignForm.student_id);
    if (!student) return;
    const existingIds: string[] = student.custom_data?.discount_rule_ids || [];
    if (existingIds.includes(assignForm.rule_id)) { setIsAssignModal(false); return; }
    const updatedIds = [...existingIds, assignForm.rule_id];
    await supabase.from('students').update({ custom_data: { ...student.custom_data, discount_rule_ids: updatedIds } }).eq('id', student.id);
    await fetchStudents();
    setIsAssignModal(false);
    setAssignForm({ student_id: '', rule_id: '' });
  };

  const handleRemoveAssignment = async (studentId: string, ruleId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const updatedIds = (student.custom_data?.discount_rule_ids || []).filter((id: string) => id !== ruleId);
    await supabase.from('students').update({ custom_data: { ...student.custom_data, discount_rule_ids: updatedIds } }).eq('id', studentId);
    await fetchStudents();
  };

  const filteredAssignments = assignments.filter(a =>
    a.student_name.toLowerCase().includes(search.toLowerCase()) || String(a.roll_number).includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="w-6 h-6 text-emerald-600" /> Discount & Scholarship
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage fee discounts and scholarships for students.</p>
        </div>
        <button onClick={() => tab === 'rules' ? setIsRuleModal(true) : setIsAssignModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> {tab === 'rules' ? 'Add Discount Rule' : 'Assign Discount'}
        </button>
      </div>

      <div className="flex border-b border-gray-200">
        {(['rules', 'students'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px capitalize transition-colors ${tab === t ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'rules' ? 'Discount Rules' : 'Student Assignments'}
          </button>
        ))}
      </div>

      {tab === 'rules' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? <div className="p-12 text-center text-gray-400">Loading...</div> :
            rules.length === 0 ? (
              <div className="p-12 text-center text-gray-400">No discount rules yet. Add your first rule above.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Rule Name</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Type</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Value</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Description</th>
                    <th className="px-6 py-3 text-right font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rules.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{r.name}</td>
                      <td className="px-6 py-4"><span className="px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-800">{r.type}</span></td>
                      <td className="px-6 py-4 font-mono text-gray-900">{r.type === 'percentage' ? `${r.value}%` : `Rs. ${r.value}`}</td>
                      <td className="px-6 py-4 text-gray-500">{r.description || '-'}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDeleteRule(r.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Search students..." />
            </div>
            <button onClick={() => exportToCSV('discount-assignments', filteredAssignments, [
              { header: 'Student', key: 'student_name' }, { header: 'Roll No', key: 'roll_number' },
              { header: 'Class', key: 'class_name' }, { header: 'Discount', key: 'rule_name' }, { header: 'Value', key: 'discount_value' },
            ])} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {filteredAssignments.length === 0 ? (
              <div className="p-12 text-center text-gray-400">No discount assignments found.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Student</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Class</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Discount Rule</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Value</th>
                    <th className="px-6 py-3 text-right font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredAssignments.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4"><p className="font-medium text-gray-900">{a.student_name}</p><p className="text-xs text-gray-400">Roll #{a.roll_number}</p></td>
                      <td className="px-6 py-4 text-gray-600">{a.class_name}</td>
                      <td className="px-6 py-4 font-medium text-emerald-700">{a.rule_name}</td>
                      <td className="px-6 py-4 font-mono text-gray-900">{a.discount_value}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleRemoveAssignment(a.student_id, a.rule_id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {isRuleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Add Discount Rule</h2>
              <button onClick={() => setIsRuleModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleAddRule} className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input required value={ruleForm.name} onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" placeholder="e.g. Siblings Discount" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={ruleForm.type} onChange={e => setRuleForm({ ...ruleForm, type: e.target.value as any })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500">
                  <option value="percentage">Percentage (%)</option><option value="flat">Flat Amount (Rs.)</option>
                </select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                <input required type="number" min="0" step="0.01" value={ruleForm.value} onChange={e => setRuleForm({ ...ruleForm, value: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input value={ruleForm.description} onChange={e => setRuleForm({ ...ruleForm, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" /></div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsRuleModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Add Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Assign Discount to Student</h2>
              <button onClick={() => setIsAssignModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleAssign} className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
                <select required value={assignForm.student_id} onChange={e => setAssignForm({ ...assignForm, student_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500">
                  <option value="">Select student...</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.full_name} (Roll #{s.roll_number})</option>)}
                </select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Discount Rule</label>
                <select required value={assignForm.rule_id} onChange={e => setAssignForm({ ...assignForm, rule_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500">
                  <option value="">Select rule...</option>
                  {rules.map(r => <option key={r.id} value={r.id}>{r.name} ({r.type === 'percentage' ? `${r.value}%` : `Rs. ${r.value}`})</option>)}
                </select></div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsAssignModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Assign</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
