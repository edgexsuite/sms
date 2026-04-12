import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Trash2, RefreshCw, XCircle, Users, Briefcase, 
  TrendingDown, AlertTriangle, Search, CheckCircle2 
} from 'lucide-react';

type TrashModule = 'students' | 'staff' | 'expenses';

export default function Trashbin() {
  const { userRole } = useAuth();
  const [activeTab, setActiveTab] = useState<TrashModule>('students');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchDeletedItems();
    }
  }, [activeTab, userRole]);

  const fetchDeletedItems = async () => {
    setLoading(true);
    let table = '';
    if (activeTab === 'students') table = 'students';
    else if (activeTab === 'staff') table = 'staff';
    else if (activeTab === 'expenses') table = 'financial_transactions';

    let query = supabase
      .from(table)
      .select('*')
      .eq('school_id', userRole?.school_id)
      .eq('is_deleted', true);
    
    if (activeTab === 'expenses') {
      query = query.eq('type', 'expense');
    }

    const { data, error } = await query.order('deleted_at', { ascending: false });
    
    if (data) setItems(data);
    setLoading(false);
  };

  const handleRestore = async (id: string) => {
    setProcessingId(id);
    try {
      const table = activeTab === 'expenses' ? 'financial_transactions' : activeTab;
      const { error } = await supabase
        .from(table)
        .update({ is_deleted: false, deleted_at: null })
        .eq('id', id);
      
      if (error) throw error;
      fetchDeletedItems();
    } catch (err: any) {
      alert('Error restoring item: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!window.confirm('WARNING: This will PERMANENTLY erase this record and its associated history. This action cannot be undone. Proceed?')) return;
    setProcessingId(id);
    try {
      const table = activeTab === 'expenses' ? 'financial_transactions' : activeTab;
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      fetchDeletedItems();
    } catch (err: any) {
      alert('Error wiping record: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm(`Are you absolutely sure you want to empty the ${activeTab} trash bin? ALL records will be lost forever.`)) return;
    setLoading(true);
    try {
      const table = activeTab === 'expenses' ? 'financial_transactions' : activeTab;
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('school_id', userRole?.school_id)
        .eq('is_deleted', true);
      
      if (error) throw error;
      fetchDeletedItems();
    } catch (err: any) {
      alert('Error clearing trash: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    const name = item.full_name || item.category || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  if (userRole?.role !== 'admin') {
     return <div className="p-20 text-center font-bold text-red-600">Unauthorized Access</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight italic">
            <Trash2 className="w-8 h-8 text-red-600" /> System Trashbin
          </h1>
          <p className="text-slate-500 font-medium">Review and recover data or perform permanent wipes.</p>
        </div>
        <button 
          onClick={handleClearAll}
          disabled={items.length === 0 || loading}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-black text-sm transition-all shadow-lg shadow-red-100 flex items-center gap-2 disabled:opacity-50"
        >
          <XCircle className="w-4 h-4" /> Empty {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Trash
        </button>
      </div>

      {/* Warning Banner */}
      <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h4 className="font-black text-amber-900 text-sm uppercase">Review Protocol</h4>
          <p className="text-amber-700 text-xs font-medium">
            Items in the trashbin are hidden from all staff. Only the Director can restore them or perform permanent deletion.
          </p>
        </div>
      </div>

      {/* Tabs and Search */}
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-2 flex flex-col md:flex-row items-center gap-4">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-full md:w-auto">
          {[
            { id: 'students', label: 'Students', icon: Users },
            { id: 'staff', label: 'Staff', icon: Briefcase },
            { id: 'expenses', label: 'Expenses', icon: TrendingDown },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TrashModule)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-black transition-all ${
                activeTab === tab.id 
                ? 'bg-white text-slate-900 shadow-md scale-105' 
                : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder={`Search deleted ${activeTab}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-600 rounded-xl outline-none transition-all font-medium text-sm" 
          />
        </div>
      </div>

      {/* Content Table */}
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="p-20 text-center text-slate-400 font-bold italic animate-pulse">Scanning database for deleted fragments...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center gap-4">
             <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                <CheckCircle2 className="w-12 h-12" />
             </div>
             <p className="text-slate-400 font-black uppercase tracking-widest text-sm">Trash is Empty</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Target Item</th>
                  <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Deleted On</th>
                  <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                          {(item.full_name || item.category || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 uppercase tracking-tight">{item.full_name || item.category}</p>
                          <p className="text-xs text-slate-400 font-bold">{item.roll_number || item.role || item.payment_mode || 'Record'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-6 text-center">
                       <span className="text-sm font-black text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                         {item.deleted_at ? new Date(item.deleted_at).toLocaleString() : 'N/A'}
                       </span>
                    </td>
                    <td className="p-6 text-right">
                       <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleRestore(item.id)}
                            disabled={processingId === item.id}
                            className="bg-white border-2 border-slate-100 hover:border-indigo-600 hover:text-indigo-600 font-black text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-2"
                          >
                             <RefreshCw className={`w-3 h-3 ${processingId === item.id ? 'animate-spin' : ''}`} /> RESTORE
                          </button>
                          <button 
                            onClick={() => handlePermanentDelete(item.id)}
                            disabled={processingId === item.id}
                            className="bg-white border-2 border-slate-100 hover:border-red-600 hover:text-red-600 font-black text-xs px-4 py-2 rounded-xl transition-all"
                          >
                             ERASE FOREVER
                          </button>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
