import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, Search, Plus, MessageSquare, CheckCircle, Clock,
  X, Save, Trash2, Filter, ChevronRight, User, AlertCircle, RefreshCw,
  MoreVertical, Send
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Complaints() {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'resolved'>('all');
  const [search, setSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [form, setForm] = useState({
    category: '',
    title: '',
    description: ''
  });

  const [resForm, setResForm] = useState({
    status: 'pending' as 'pending' | 'in_progress' | 'resolved',
    resolution_notes: ''
  });

  useEffect(() => {
    if (userRole?.school_id) {
      fetchComplaints();
    }
  }, [userRole, activeTab]);

  const fetchComplaints = async () => {
    setLoading(true);
    const sid = userRole?.school_id;
    
    let query = supabase
      .from('complaints')
      .select('*')
      .eq('school_id', sid)
      .order('created_at', { ascending: false });

    if (activeTab === 'pending') query = query.in('status', ['pending', 'in_progress']);
    if (activeTab === 'resolved') query = query.eq('status', 'resolved');

    // If Parent, restrict to their own complaints
    if (userRole?.role === 'parent') {
      query = query.eq('user_id', userRole.user_id);
    }

    const { data } = await query;
    if (data) setComplaints(data);
    setLoading(false);
  };

  const handleLogComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userRole?.school_id) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.from('complaints').insert([{
        ...form,
        school_id: userRole.school_id,
        user_id: userRole.role === 'parent' ? userRole.user_id : null, 
        status: 'pending'
      }]);

      if (error) throw error;
      setIsModalOpen(false);
      setForm({ category: '', title: '', description: '' });
      fetchComplaints();
    } catch (error: any) {
      alert(error.message);
    }
    setSaving(false);
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('complaints')
        .update({
          status: resForm.status,
          resolution_notes: resForm.resolution_notes,
          resolved_at: resForm.status === 'resolved' ? new Date().toISOString() : null,
          // resolved_by: current staff id
        })
        .eq('id', selectedComplaint.id);

      if (error) throw error;
      setIsManageModalOpen(false);
      fetchComplaints();
    } catch (error: any) {
      alert(error.message);
    }
    setSaving(false);
  };

  const filteredComplaints = complaints.filter(c => 
    c.title.toLowerCase().includes(search.toLowerCase()) || 
    c.category.toLowerCase().includes(search.toLowerCase())
  );

  const categories = ['Facilities', 'Transport', 'Academics', 'Discipline', 'Staff Behavior', 'Fees/Billing', 'Other'];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <AlertCircle className="w-7 h-7 text-red-500" /> Complaint & Feedback System
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Report grievances, track resolution status, and manage school tickets.</p>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-100 hover:bg-red-700 transition-all"
        >
          <Plus className="w-4 h-4" /> Log New Complaint
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         {[
           { label: 'Pending Resolution', value: complaints.filter(c => c.status !== 'resolved').length, color: 'text-orange-600 bg-orange-50' },
           { label: 'In Progress', value: complaints.filter(c => c.status === 'in_progress').length, color: 'text-blue-600 bg-blue-50' },
           { label: 'Total Resolved', value: complaints.filter(c => c.status === 'resolved').length, color: 'text-green-600 bg-green-50' },
         ].map(s => (
           <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between shadow-sm">
             <div>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{s.label}</p>
               <p className="text-2xl font-black text-gray-900">{s.value}</p>
             </div>
             <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
                <AlertTriangle className="w-5 h-5" />
             </div>
           </div>
         ))}
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex flex-col md:flex-row justify-between gap-4">
           {/* Tabs and Search */}
           <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
              {['all', 'pending', 'resolved'].map(t => (
                <button 
                  key={t} onClick={() => setActiveTab(t as any)}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold capitalize transition-all ${activeTab === t ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  {t}
                </button>
              ))}
           </div>
           <div className="relative flex-1 md:max-w-sm">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
             <input 
               type="text" placeholder="Search by title or category..."
               value={search} onChange={e => setSearch(e.target.value)}
               className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all outline-none"
             />
           </div>
        </div>

        {loading ? (
          <div className="p-20 text-center flex flex-col items-center gap-3 text-gray-400">
             <RefreshCw className="w-8 h-8 animate-spin" />
             <p className="font-bold uppercase tracking-widest text-[10px]">Syncing Tickets...</p>
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center gap-3">
             <CheckCircle className="w-12 h-12 text-gray-200" />
             <p className="text-gray-500 font-medium italic">All quiet! No complaints found here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <th className="px-6 py-4">Ticket Status</th>
                  <th className="px-6 py-4">Issue Details</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Submitted</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredComplaints.map(c => (
                  <tr key={c.id} className="group hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                        c.status === 'resolved' ? 'bg-green-50 text-green-600 border-green-100' :
                        c.status === 'in_progress' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        'bg-red-50 text-red-600 border-red-100'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${c.status === 'resolved' ? 'bg-green-600' : c.status === 'in_progress' ? 'bg-blue-600' : 'bg-red-600'}`} />
                        {c.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                       <p className="text-sm font-black text-gray-900 group-hover:text-red-600 transition-colors uppercase tracking-tight">{c.title}</p>
                       <p className="text-xs text-gray-400 truncate max-w-sm">{c.description}</p>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md">{c.category}</span>
                    </td>
                    <td className="px-6 py-4">
                       <p className="text-[10px] font-bold text-gray-500 uppercase">{new Date(c.created_at).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <button 
                         onClick={() => { setSelectedComplaint(c); setResForm({status: c.status, resolution_notes: c.resolution_notes || ''}); setIsManageModalOpen(true); }}
                         className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100"
                       >
                         <MoreVertical className="w-4 h-4" />
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Complaint Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
             <div className="bg-red-600 px-8 py-6 flex justify-between items-center text-white">
               <div>
                 <h3 className="text-xl font-black tracking-tight uppercase">Log New Issue</h3>
                 <p className="text-red-100 text-[10px] mt-1 uppercase font-bold tracking-widest leading-none">Formal Grievance Submission</p>
               </div>
               <button onClick={() => setIsModalOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"><X className="w-5 h-5" /></button>
             </div>
             
             <form onSubmit={handleLogComplaint} className="p-8 space-y-5 bg-gray-50">
                <div>
                   <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest pl-1">Issue Category <span className="text-red-500">*</span></label>
                   <select 
                     required value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                     className="w-full bg-white border border-gray-200 px-4 py-3 rounded-xl text-sm font-bold focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all outline-none"
                   >
                     <option value="">-- Choose Category --</option>
                     {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                   </select>
                </div>

                <div>
                   <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest pl-1">Subject / Title <span className="text-red-500">*</span></label>
                   <input 
                     required type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                     className="w-full bg-white border border-gray-200 px-4 py-3 rounded-xl text-sm font-bold focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all"
                     placeholder="e.g. Broken AC in Room 10th-A"
                   />
                </div>

                <div>
                   <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest pl-1">Detailed Description <span className="text-red-500">*</span></label>
                   <textarea 
                     required rows={5} value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                     className="w-full bg-white border border-gray-200 p-4 rounded-xl text-sm font-medium focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all resize-none shadow-sm"
                     placeholder="Explain the issue in detail..."
                   />
                </div>
             </form>

             <div className="p-8 bg-white border-t border-gray-100 flex gap-3">
               <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all">Cancel</button>
               <button onClick={handleLogComplaint} disabled={saving} className="flex-[2] py-3 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 shadow-xl shadow-red-100 transition-all flex items-center justify-center gap-2">
                 <Send className="w-5 h-5" /> {saving ? 'Submitting...' : 'Send Complaint'}
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Manage / Resolve Modal */}
      {isManageModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
             <div className="bg-gray-800 px-8 py-6 flex justify-between items-center text-white">
               <div>
                 <h3 className="text-xl font-black tracking-tight uppercase">Manage Ticket</h3>
                 <p className="text-gray-400 text-[10px] mt-1 uppercase font-bold tracking-widest leading-none">Resolution & Status Tracking</p>
               </div>
               <button onClick={() => setIsManageModalOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"><X className="w-5 h-5" /></button>
             </div>
             
             <div className="p-8 bg-gray-50 space-y-6">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-2 mb-3">Original Issue</p>
                   <h4 className="font-black text-gray-900 mb-1">{selectedComplaint?.title}</h4>
                   <p className="text-sm text-gray-600">{selectedComplaint?.description}</p>
                </div>

                <form onSubmit={handleUpdateStatus} className="space-y-4">
                   <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest pl-1">Update Status</label>
                      <div className="flex gap-2 p-1 bg-white border border-gray-200 rounded-xl">
                         {['pending', 'in_progress', 'resolved'].map(stat => (
                           <button 
                             key={stat} type="button" 
                             onClick={() => setResForm({...resForm, status: stat as any})}
                             className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all capitalize ${resForm.status === stat ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400'}`}
                           >
                             {stat.replace('_', ' ')}
                           </button>
                         ))}
                      </div>
                   </div>

                   <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest pl-1">Resolution / Response Notes</label>
                      <textarea 
                        rows={3} value={resForm.resolution_notes} onChange={e => setResForm({...resForm, resolution_notes: e.target.value})}
                        className="w-full bg-white border border-gray-200 p-4 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none shadow-sm"
                        placeholder="Add internal notes or response to parent..."
                      />
                   </div>
                </form>
             </div>

             <div className="p-8 bg-white border-t border-gray-100 flex gap-3">
                <button onClick={() => setIsManageModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all">Cancel</button>
                <button onClick={handleUpdateStatus} className="flex-[2] py-3 bg-gray-900 text-white font-bold rounded-2xl hover:bg-black transition-all flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5" /> Update Ticket
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
