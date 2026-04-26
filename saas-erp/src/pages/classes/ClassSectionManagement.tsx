import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BookOpen, PlusCircle, Pencil, Trash2, Save, X, Users2, ChevronDown } from 'lucide-react';

export default function ClassSectionManagement() {
  const { userRole } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    section: '',
    class_teacher_id: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchAll();
    }
  }, [userRole]);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: cls }, { data: stf }] = await Promise.all([
      supabase.from('classes').select('*, staff(full_name)').eq('school_id', userRole?.school_id).order('name').order('section'),
      supabase.from('staff').select('id, full_name, role').eq('school_id', userRole?.school_id).eq('is_active', true).order('full_name')
    ]);
    if (cls) setClasses(cls);
    if (stf) setStaff(stf);
    setLoading(false);
  };

  const openCreate = () => {
    setEditId(null);
    setFormData({ name: '', section: 'A', class_teacher_id: '' });
    setShowForm(true);
  };

  const openEdit = (cls: any) => {
    setEditId(cls.id);
    setFormData({
      name: cls.name,
      section: cls.section,
      class_teacher_id: cls.class_teacher_id || ''
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return alert('Class name is required.');
    setSaving(true);
    try {
      const payload = {
        school_id: userRole?.school_id,
        name: formData.name.trim(),
        section: formData.section.trim(),
        class_teacher_id: formData.class_teacher_id || null
      };

      if (editId) {
        const { error } = await supabase.from('classes').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('classes').insert([payload]);
        if (error) throw error;
      }

      setShowForm(false);
      fetchAll();
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete class "${name}"? This will affect all student and fee records linked to this class.`)) return;
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) return alert(error.message);
    fetchAll();
  };

  // Group classes by name for a clean tree view
  const grouped = classes.reduce((acc: any, cls) => {
    if (!acc[cls.name]) acc[cls.name] = [];
    acc[cls.name].push(cls);
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" /> Class & Section Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Configure all classes and sections. Assign a class teacher to each section.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold shadow transition"
        >
          <PlusCircle className="w-4 h-4" /> Add New Class
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Classes', value: Object.keys(grouped).length, color: 'bg-blue-50 text-blue-700 border-blue-200' },
          { label: 'Total Sections', value: classes.length, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
          { label: 'With Teacher Assigned', value: classes.filter(c => c.class_teacher_id).length, color: 'bg-green-50 text-green-700 border-green-200' },
          { label: 'Unassigned', value: classes.filter(c => !c.class_teacher_id).length, color: 'bg-orange-50 text-orange-700 border-orange-200' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border p-4 ${stat.color}`}>
            <p className="text-3xl font-black">{stat.value}</p>
            <p className="text-xs font-semibold mt-1 uppercase tracking-wide opacity-80">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Class Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 font-medium">Loading classes...</div>
        ) : classes.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No classes configured yet.</p>
            <p className="text-gray-400 text-sm mt-1">Click "Add New Class" to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {Object.entries(grouped).map(([className, sections]: any) => (
              <div key={className}>
                <div className="flex items-center gap-3 px-6 py-3 bg-gray-50 border-b border-gray-200">
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                  <h3 className="font-black text-gray-800 tracking-wide text-sm uppercase">{className}</h3>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{sections.length} section{sections.length > 1 ? 's' : ''}</span>
                </div>
                {sections.map((cls: any) => (
                  <div key={cls.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center font-black text-blue-700 text-sm">
                        {cls.section}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{cls.name} {cls.section ? `— Section ${cls.section}` : ''}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Users2 className="w-3 h-3 text-gray-400" />
                          <p className="text-xs text-gray-500">
                            Class Teacher: {cls.staff?.full_name || <span className="text-orange-500 italic">Not Assigned</span>}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(cls)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(cls.id, `${cls.name} ${cls.section}`)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showForm && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-blue-600 px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                {editId ? 'Edit Class Section' : 'Create New Class'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-blue-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 bg-gray-50">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Class Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Class 1"
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-blue-500 font-medium text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Section</label>
                  <input
                    type="text"
                    value={formData.section}
                    onChange={e => setFormData({ ...formData, section: e.target.value })}
                    placeholder="e.g. A (Optional)"
                    className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-blue-500 font-medium text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Assign Class Teacher</label>
                <select
                  value={formData.class_teacher_id}
                  onChange={e => setFormData({ ...formData, class_teacher_id: e.target.value })}
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-blue-500 font-medium text-sm bg-white"
                >
                  <option value="">-- Select a Staff Member --</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>
                  ))}
                </select>
                {staff.length === 0 && (
                  <p className="text-xs text-orange-500 mt-1 italic">No staff found. Add staff members first to assign a class teacher.</p>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-white border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow flex items-center gap-2 disabled:opacity-50 transition"
              >
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : editId ? 'Update Class' : 'Create Class'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
