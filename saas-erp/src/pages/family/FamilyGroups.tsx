import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Home, Plus, X, ChevronDown, ChevronRight, Users, Download } from 'lucide-react';
import { exportToExcel } from '../../lib/exportUtils';

interface Family {
  id: string;
  family_name: string;
  primary_contact: string;
  primary_phone: string;
  children?: any[];
}

export default function FamilyGroups() {
  const { userRole } = useAuth();
  const [families, setFamilies] = useState<Family[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState<string | null>(null); // family id
  const [form, setForm] = useState({ family_name: '', primary_contact: '', primary_phone: '' });
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (userRole?.school_id) { fetchFamilies(); fetchUnlinkedStudents(); }
  }, [userRole]);

  const fetchFamilies = async () => {
    setLoading(true);
    const sid = userRole!.school_id;
    const { data: fams } = await supabase.from('family_groups').select('*').eq('school_id', sid).order('family_name');
    if (!fams) { setLoading(false); return; }

    const { data: kids } = await supabase
      .from('students')
      .select('id, full_name, roll_number, class_id, family_group_id, class:class_id(name, section)')
      .eq('school_id', sid)
      .not('family_group_id', 'is', null);

    const kidsByFamily = new Map<string, any[]>();
    (kids || []).forEach(k => {
      if (!kidsByFamily.has(k.family_group_id)) kidsByFamily.set(k.family_group_id, []);
      kidsByFamily.get(k.family_group_id)!.push(k);
    });

    setFamilies(fams.map(f => ({ ...f, children: kidsByFamily.get(f.id) || [] })));
    setLoading(false);
  };

  const fetchUnlinkedStudents = async () => {
    const { data } = await supabase
      .from('students').select('id, full_name, roll_number')
      .eq('school_id', userRole!.school_id).eq('status', 'active')
      .is('family_group_id', null).order('full_name');
    setStudents(data || []);
  };

  const createFamily = async () => {
    if (!form.family_name.trim()) return;
    setSaving(true);
    await supabase.from('family_groups').insert({ ...form, school_id: userRole!.school_id });
    setSaving(false); setShowModal(false);
    setForm({ family_name: '', primary_contact: '', primary_phone: '' });
    fetchFamilies(); fetchUnlinkedStudents();
  };

  const linkStudent = async (familyId: string) => {
    if (!selectedStudentId) return;
    await supabase.from('students').update({ family_group_id: familyId }).eq('id', selectedStudentId);
    setShowLinkModal(null); setSelectedStudentId('');
    fetchFamilies(); fetchUnlinkedStudents();
  };

  const unlinkStudent = async (studentId: string) => {
    await supabase.from('students').update({ family_group_id: null }).eq('id', studentId);
    fetchFamilies(); fetchUnlinkedStudents();
  };

  const toggleExpand = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const exportData = families.flatMap(f =>
    (f.children || []).map(c => ({ family: f.family_name, contact: f.primary_phone, student: c.full_name, class: c.class ? `${c.class.name}-${c.class.section}` : '' }))
  );

  if (loading) return <div className="p-12 text-center text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Home className="w-6 h-6 text-rose-600" /> Family Groups
          </h1>
          <p className="text-gray-500 text-sm mt-1">Link siblings under one family account for unified fee management.</p>
        </div>
        <div className="flex gap-2">
          {exportData.length > 0 && (
            <button onClick={() => exportToExcel('family-groups', exportData, [
              { header: 'Family', key: 'family' }, { header: 'Contact', key: 'contact' },
              { header: 'Student', key: 'student' }, { header: 'Class', key: 'class' },
            ])} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" /> Export
            </button>
          )}
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700">
            <Plus className="w-4 h-4" /> New Family
          </button>
        </div>
      </div>

      {students.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          <strong>{students.length} student{students.length > 1 ? 's' : ''}</strong> not linked to any family. Open a family group and click "Add Child" to link them.
        </div>
      )}

      {families.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center text-gray-400">
          <Home className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p>No family groups yet. Create one to link siblings together.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {families.map(f => (
            <div key={f.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <button onClick={() => toggleExpand(f.id)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 text-left">
                <div className="flex items-center gap-3">
                  {expanded.has(f.id) ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <div>
                    <p className="font-semibold text-gray-900">{f.family_name}</p>
                    <p className="text-xs text-gray-400">{f.primary_contact} · {f.primary_phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Users className="w-3.5 h-3.5" /> {f.children?.length || 0} child{(f.children?.length || 0) !== 1 ? 'ren' : ''}
                  </span>
                  <button onClick={e => { e.stopPropagation(); setShowLinkModal(f.id); setSelectedStudentId(''); }}
                    className="text-xs px-2 py-1 bg-rose-50 text-rose-700 rounded hover:bg-rose-100 font-medium">
                    + Add Child
                  </button>
                </div>
              </button>

              {expanded.has(f.id) && (f.children?.length || 0) > 0 && (
                <div className="border-t border-gray-100">
                  {f.children!.map(c => (
                    <div key={c.id} className="flex items-center justify-between px-8 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{c.full_name}</p>
                        <p className="text-xs text-gray-400">{c.class ? `${c.class.name}-${c.class.section}` : ''} · Roll #{c.roll_number}</p>
                      </div>
                      <button onClick={() => unlinkStudent(c.id)} className="text-xs text-gray-400 hover:text-red-600">Unlink</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Family Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Create Family Group</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Family Name * (e.g. Khan Family)</label>
                <input value={form.family_name} onChange={e => setForm({ ...form, family_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Primary Contact Name</label>
                <input value={form.primary_contact} onChange={e => setForm({ ...form, primary_contact: e.target.value })} placeholder="Father/Guardian name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phone Number</label>
                <input value={form.primary_phone} onChange={e => setForm({ ...form, primary_phone: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={createFamily} disabled={saving || !form.family_name.trim()}
                className="px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Family'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Student Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Add Child to Family</h2>
              <button onClick={() => setShowLinkModal(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5">
              <label className="block text-xs font-medium text-gray-500 mb-1">Select Student (unlinked only)</label>
              <select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500">
                <option value="">Select student...</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.full_name} (Roll #{s.roll_number})</option>)}
              </select>
              {students.length === 0 && <p className="text-xs text-gray-400 mt-2">All students are already linked to a family.</p>}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-200">
              <button onClick={() => setShowLinkModal(null)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => linkStudent(showLinkModal)} disabled={!selectedStudentId}
                className="px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 disabled:opacity-50">
                Link Student
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
