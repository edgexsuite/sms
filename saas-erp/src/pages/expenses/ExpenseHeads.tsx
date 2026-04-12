import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FolderGit2, Plus, Trash2, Edit2, Save, X } from 'lucide-react';

export default function ExpenseHeads() {
  const { userRole } = useAuth();
  const [heads, setHeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create / Edit state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [formData, setFormData] = useState({ name: '', description: '' });

  useEffect(() => {
    if (userRole?.school_id) fetchHeads();
  }, [userRole]);

  const fetchHeads = async () => {
    setLoading(true);
    const { data } = await supabase.from('expense_heads').select('*').eq('school_id', userRole?.school_id).order('name');
    if (data) setHeads(data);
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert('Name required');

    try {
      if (editingId) {
        await supabase.from('expense_heads').update(formData).eq('id', editingId);
      } else {
        await supabase.from('expense_heads').insert([{
           school_id: userRole?.school_id,
           name: formData.name,
           description: formData.description
        }]);
      }
      setIsFormOpen(false);
      setEditingId('');
      setFormData({ name: '', description: '' });
      fetchHeads();
    } catch (err: any) { alert(err.message); }
  };

  const handleDelete = async (id: string) => {
    if(!confirm("Are you sure? This cannot be undone.")) return;
    try {
      const { error } = await supabase.from('expense_heads').delete().eq('id', id);
      if (error) alert("Cannot delete. It may be linked to active expenses.");
      else fetchHeads();
    } catch (err: any) { alert(err.message); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FolderGit2 className="w-6 h-6 text-blue-600" /> Expense Heads</h1>
          <p className="text-gray-500 text-sm mt-1">Manage categories for your operational expenses (e.g. Salaries, Utilities, Maintenance).</p>
        </div>
        <button onClick={() => { setIsFormOpen(true); setEditingId(''); setFormData({name:'', description:''}) }} className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-blue-700 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6 relative">
          <button onClick={() => setIsFormOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
          <h3 className="font-bold text-gray-900 mb-4">{editingId ? 'Edit Category' : 'New Expense Category'}</h3>
          <form onSubmit={handleSave} className="flex gap-4 items-start">
             <div className="flex-1">
               <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Head Name</label>
               <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Electricity Bill" className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-blue-500 text-sm" />
             </div>
             <div className="flex-[2]">
               <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Description (Optional)</label>
               <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="General utility expenses" className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-blue-500 text-sm" />
             </div>
             <div className="pt-5">
               <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-md font-medium flex items-center gap-2 shadow hover:bg-blue-700">
                 <Save className="w-4 h-4" /> Save
               </button>
             </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-4 font-medium text-gray-700">Category Name</th>
              <th className="p-4 font-medium text-gray-700">Description</th>
              <th className="p-4 font-medium text-gray-700 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
             {loading ? <tr><td colSpan={3} className="p-8 text-center text-gray-500">Loading...</td></tr> : 
              heads.length === 0 ? <tr><td colSpan={3} className="p-8 text-center text-gray-500">No expense heads configured yet.</td></tr> :
              heads.map(h => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="p-4 font-bold text-gray-900">{h.name}</td>
                  <td className="p-4 text-gray-600">{h.description || '-'}</td>
                  <td className="p-4 text-right flex justify-end gap-2">
                     <button onClick={() => { setEditingId(h.id); setFormData({name: h.name, description: h.description}); setIsFormOpen(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                     <button onClick={() => handleDelete(h.id)} className="p-1.5 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))
             }
          </tbody>
        </table>
      </div>
    </div>
  );
}
