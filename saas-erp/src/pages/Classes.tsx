import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, BookOpen, Users, Clock, Edit2 } from 'lucide-react';

interface Staff {
  id: string;
  full_name: string;
}

interface ClassData {
  id: string;
  name: string;
  section: string;
  class_teacher_id: string | null;
  staff?: { full_name: string } | null;
}

export default function Classes() {
  const { userRole } = useAuth();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassData | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    section: '',
    class_teacher_id: '',
  });

  useEffect(() => {
    if (userRole?.school_id) {
      fetchClasses();
      fetchStaff();
    }
  }, [userRole]);

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
          staff:class_teacher_id(full_name)
        `)
        .order('name', { ascending: true });

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name', { ascending: true });

      if (error) throw error;
      setStaffList(data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userRole?.school_id) return;

    try {
      if (editingClass) {
        const { error } = await supabase
          .from('classes')
          .update({
            name: formData.name,
            section: formData.section,
            class_teacher_id: formData.class_teacher_id || null,
          })
          .eq('id', editingClass.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('classes').insert([
          {
            school_id: userRole.school_id,
            name: formData.name,
            section: formData.section,
            class_teacher_id: formData.class_teacher_id || null,
          },
        ]);

        if (error) throw error;
      }
      
      setIsAddModalOpen(false);
      setEditingClass(null);
      setFormData({ name: '', section: '', class_teacher_id: '' });
      fetchClasses();
    } catch (error: any) {
      alert(error.message || 'Error saving class');
    }
  };

  const handleEditClick = (cls: ClassData) => {
    setEditingClass(cls);
    setFormData({
      name: cls.name,
      section: cls.section,
      class_teacher_id: cls.class_teacher_id || '',
    });
    setIsAddModalOpen(true);
  };

  const openAddModal = () => {
    setEditingClass(null);
    setFormData({ name: '', section: '', class_teacher_id: '' });
    setIsAddModalOpen(true);
  };

  const filteredClasses = classes.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.section.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Classes & Sections</h1>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search classes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          {userRole?.role === 'admin' && (
            <button 
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Class</span>
            </button>
          )}
        </div>
      </div>

      {/* Data Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full p-8 text-center text-gray-500">Loading classes...</div>
        ) : filteredClasses.length === 0 ? (
          <div className="col-span-full p-8 text-center text-gray-500 bg-white rounded-lg border border-gray-200">No classes found.</div>
        ) : (
          filteredClasses.map((cls) => (
            <div key={cls.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5 border-b border-gray-100 flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{cls.name}</h3>
                  {cls.section && <p className="text-sm text-gray-500 font-medium mt-1">Section {cls.section}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {userRole?.role === 'admin' && (
                    <button 
                      onClick={() => handleEditClick(cls)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                      title="Edit Class"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </div>
              <div className="p-5 bg-gray-50/50 space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span>Teacher: <span className="font-medium text-gray-900">{cls.staff?.full_name || 'Unassigned'}</span></span>
                </div>
                <div className="flex gap-2 pt-2">
                  <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    <Users className="w-4 h-4" />
                    Students
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    <Clock className="w-4 h-4" />
                    Timetable
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Class Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">{editingClass ? 'Edit Class' : 'Add New Class'}</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleSaveClass} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Grade 10"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                <input
                  type="text"
                  placeholder="e.g., A, B, Rose (Optional)"
                  value={formData.section}
                  onChange={(e) => setFormData({...formData, section: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Teacher</label>
                <select
                  value={formData.class_teacher_id}
                  onChange={(e) => setFormData({...formData, class_teacher_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Unassigned --</option>
                  {staffList.map(staff => (
                    <option key={staff.id} value={staff.id}>{staff.full_name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">You can assign a teacher later if they are not in the system yet.</p>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  {editingClass ? 'Save Changes' : 'Save Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
