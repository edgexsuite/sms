import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Banknote, TrendingDown, Save, Calendar, Search, Trash2 } from 'lucide-react';
import DeletePinModal from '../../components/DeletePinModal';

export default function AddDailyExpenses() {
  const { userRole } = useAuth();
  const [heads, setHeads] = useState<any[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; name: string }>({ isOpen: false, id: '', name: '' });

  const [formData, setFormData] = useState({
    amount: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    payment_mode: 'Cash',
    remarks: ''
  });

  useEffect(() => {
    if (userRole?.school_id) {
      fetchHeads();
      fetchRecent();
    }
  }, [userRole]);

  const fetchHeads = async () => {
    const { data } = await supabase.from('expense_heads').select('*').eq('school_id', userRole?.school_id).order('name');
    if (data) setHeads(data);
  };

  const fetchRecent = async () => {
    const { data } = await supabase.from('financial_transactions')
      .select('*')
      .eq('school_id', userRole?.school_id)
      .eq('type', 'expense')
      .eq('is_deleted', false)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setRecentExpenses(data);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.category) return setError('Amount and Category are required.');
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.from('financial_transactions').insert([{
        school_id: userRole?.school_id,
        type: 'expense',
        amount: parseFloat(formData.amount),
        category: formData.category,
        payment_mode: formData.payment_mode,
        date: formData.date,
        remarks: formData.remarks
      }]);
      if (error) throw error;
      
      setFormData({ ...formData, amount: '', remarks: '' }); // reset partial
      fetchRecent();
      alert('Expense permanently logged to the Daily Ledger!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteModal.id) return;
    try {
      const { error } = await supabase
        .from('financial_transactions')
        .update({ 
          is_deleted: true, 
          deleted_at: new Date().toISOString() 
        })
        .eq('id', deleteModal.id);
        
      if (error) throw error;
      fetchRecent();
    } catch (err: any) {
      alert('Error moving expense to trash: ' + err.message);
    }
  };

  const todayTotal = recentExpenses
    .filter(r => r.date === new Date().toISOString().split('T')[0])
    .reduce((sum, r) => sum + parseFloat(r.amount), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><TrendingDown className="w-6 h-6 text-red-500" /> Log Daily Expense</h1>
        <p className="text-gray-500 text-sm mt-1">Record outward cash flow. These automatically sync with the Master Day Book.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Form Panel */}
         <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6 self-start">
            <h2 className="font-bold text-gray-900 border-b border-gray-200 pb-3 mb-4">New Transaction</h2>
            {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded mb-4">{error}</div>}
            
            <form onSubmit={handleSave} className="space-y-4">
               <div>
                 <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Expense Amount</label>
                 <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <span className="text-gray-500 font-medium sm:text-sm">PKR</span>
                   </div>
                   <input type="number" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full border border-gray-300 pl-12 pr-3 py-2 rounded focus:ring-red-500 text-lg font-bold" placeholder="0.00" />
                 </div>
               </div>

               <div>
                 <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Category / Head</label>
                 <select required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-red-500 bg-white shadow-sm">
                   <option value="">-- Assign a Category --</option>
                   {heads.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                 </select>
                 {heads.length === 0 && <p className="text-[10px] text-red-500 mt-1">Please create Expense Heads first.</p>}
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Date</label>
                   <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-red-500 text-sm shadow-sm" />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Payment Mode</label>
                   <select value={formData.payment_mode} onChange={e => setFormData({...formData, payment_mode: e.target.value})} className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-red-500 bg-white text-sm shadow-sm">
                     <option value="Cash">Cash</option>
                     <option value="Bank">Bank Deposit/Transfer</option>
                     <option value="Cheque">Cheque</option>
                   </select>
                 </div>
               </div>

               <div>
                 <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Remarks / Details</label>
                 <textarea rows={3} value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-red-500 text-sm shadow-sm placeholder-gray-400" placeholder="E.g., Paid electric bill for month of March..."></textarea>
               </div>

               <div className="pt-2">
                 <button type="submit" disabled={loading} className="w-full bg-red-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 shadow hover:bg-red-700 disabled:opacity-50">
                   {loading ? 'Committing...' : <><Save className="w-5 h-5" /> Commit to Ledger</>}
                 </button>
               </div>
            </form>
         </div>

         {/* Latest Records Panel */}
         <div className="lg:col-span-2 space-y-6">
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center justify-between shadow-sm">
               <div>
                  <h3 className="text-red-800 font-bold text-lg">Today's Expenses Outflow</h3>
                  <p className="text-red-600 text-sm font-medium">As of {new Date().toLocaleDateString()}</p>
               </div>
               <div className="text-right">
                  <span className="text-4xl font-black text-red-900 tracking-tight">
                    PKR {todayTotal.toLocaleString()}
                  </span>
               </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
               <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                 <h3 className="font-bold text-gray-800 flex items-center gap-2"><Calendar className="w-5 h-5 text-gray-500" /> Recent Expense Logs</h3>
               </div>
               <table className="w-full text-left text-sm">
                 <thead className="bg-white border-b border-gray-100">
                   <tr>
                     <th className="p-4 font-medium text-gray-500">Date</th>
                     <th className="p-4 font-medium text-gray-500">Category</th>
                     <th className="p-4 font-medium text-gray-500">Mode</th>
                     <th className="p-4 font-medium text-gray-500">Remarks</th>
                     <th className="p-4 font-medium text-gray-500 text-right">Amount</th>
                     <th className="p-4 font-medium text-gray-500 text-center">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                    {recentExpenses.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-gray-400">No recent expenses logged.</td></tr> :
                     recentExpenses.map(exp => (
                       <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                         <td className="p-4 text-gray-900 font-medium whitespace-nowrap">{new Date(exp.date).toLocaleDateString()}</td>
                         <td className="p-4"><span className="bg-gray-100 text-gray-700 font-medium px-2 py-0.5 rounded text-xs">{exp.category}</span></td>
                         <td className="p-4 text-gray-500">{exp.payment_mode}</td>
                         <td className="p-4 text-gray-500 max-w-xs truncate" title={exp.remarks}>{exp.remarks || '-'}</td>
                         <td className="p-4 text-right font-bold text-red-600 whitespace-nowrap">Rs. {exp.amount.toLocaleString()}</td>
                         <td className="p-4 text-center">
                           <button 
                             onClick={() => setDeleteModal({ isOpen: true, id: exp.id, name: `${exp.category} (Rs. ${exp.amount})` })}
                             className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </td>
                       </tr>
                     ))
                    }
                 </tbody>
               </table>
            </div>
         </div>
      </div>

      {/* Delete Pin Modal */}
      <DeletePinModal 
        isOpen={deleteModal.isOpen}
        schoolId={userRole?.school_id || ''}
        itemName={deleteModal.name}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={executeDelete}
      />
    </div>
  );
}
