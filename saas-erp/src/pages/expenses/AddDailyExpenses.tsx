import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  TrendingDown, Upload, Calendar,
  Save, Trash2, Pencil, AlertTriangle
} from 'lucide-react';
import DeletePinModal from '../../components/DeletePinModal';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate } from '../../lib/utils';

export default function AddDailyExpenses() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const dateRef = useRef<HTMLInputElement>(null);
  const [heads, setHeads] = useState<any[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; name: string }>({ isOpen: false, id: '', name: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [duplicateAlert, setDuplicateAlert] = useState<any | null>(null);

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

  const loadForEdit = (exp: any) => {
    setEditingId(exp.id);
    setDuplicateAlert(null);
    setFormData({
      amount: String(exp.amount),
      category: exp.category,
      date: exp.date,
      payment_mode: exp.payment_mode || 'Cash',
      remarks: exp.remarks || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDuplicateAlert(null);
    setFormData({ amount: '', category: '', date: new Date().toISOString().split('T')[0], payment_mode: 'Cash', remarks: '' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.category) return setError('Amount and Category are required.');
    setLoading(true);
    setError('');
    setDuplicateAlert(null);

    try {
      // If already editing an existing record, just update it
      if (editingId) {
        const { error } = await supabase.from('financial_transactions')
          .update({
            amount: parseFloat(formData.amount),
            category: formData.category,
            payment_mode: formData.payment_mode,
            date: formData.date,
            remarks: formData.remarks
          })
          .eq('id', editingId);
        if (error) throw error;
        setEditingId(null);
        setFormData({ amount: '', category: '', date: new Date().toISOString().split('T')[0], payment_mode: 'Cash', remarks: '' });
        fetchRecent();
        alert('Expense updated successfully!');
        return;
      }

      // Check for duplicate (same category + date)
      const { data: existing } = await supabase.from('financial_transactions')
        .select('*')
        .eq('school_id', userRole?.school_id)
        .eq('type', 'expense')
        .eq('is_deleted', false)
        .eq('category', formData.category)
        .eq('date', formData.date)
        .maybeSingle();

      if (existing) {
        setDuplicateAlert(existing);
        setLoading(false);
        return;
      }

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

      setFormData({ ...formData, amount: '', remarks: '' });
      fetchRecent();
      alert('Expense permanently logged to the Daily Ledger!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addAnywayAndSave = async () => {
    setDuplicateAlert(null);
    setLoading(true);
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
      setFormData({ ...formData, amount: '', remarks: '' });
      fetchRecent();
      alert('Expense logged!');
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
    <div className="max-w-6xl mx-auto space-y-10 animate-aura-in">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
      >
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight font-display uppercase tracking-tight">Financial Ledger</h1>
          <p className="text-slate-500 text-sm font-bold mt-1 opacity-70 uppercase tracking-[0.15em]">Daily Outward Cash Flow Tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-200">
                  <TrendingDown className="w-6 h-6 text-white" />
              </div>
              <div>
                  <p className="text-[10px] font-black text-red-400 uppercase tracking-widest leading-none">Status</p>
                  <p className="text-sm font-black text-red-700 uppercase tracking-tight mt-1">Ready for Entry</p>
              </div>
          </div>
          <button 
            onClick={() => navigate('/expenses/bulk-import')}
            className="px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-rose-600 hover:border-rose-100 transition-all shadow-sm active:scale-95 flex items-center gap-3"
          >
            <Upload className="w-4 h-4" /> Bulk Migration
          </button>
        </div>
      </motion.div>

      {/* Guidance Banner - Aura Style */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-indigo-600 rounded-3xl p-6 flex items-center gap-6 shadow-2xl shadow-indigo-100 border border-indigo-500/20"
      >
        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
          <TrendingDown className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-white font-black text-sm uppercase tracking-widest leading-none">Primary Cash Ledger</h3>
          <p className="text-indigo-100 text-xs font-bold mt-1.5 opacity-80">
            Log all electricity bills, salaries, and vendor payments here. 
            For non-cash adjustments like depreciation or corrections, navigate to <span className="underline cursor-pointer" onClick={() => navigate('/accounting/journal-entry')}>Accounting → Journal Entry</span>.
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Form Panel - Aura Style */}
         <motion.div 
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ delay: 0.1 }}
           className="lg:col-span-1 aura-card p-8 self-start border-none shadow-2xl shadow-slate-200/50"
         >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">
                {editingId ? 'Edit Transaction' : 'New Transaction'}
              </h2>
              {editingId && (
                <button onClick={cancelEdit} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-600 transition-colors">
                  Cancel
                </button>
              )}
            </div>
            {error && <div className="text-[10px] font-black uppercase tracking-widest text-red-600 bg-red-50 p-3 rounded-xl mb-6 border border-red-100">{error}</div>}

            {/* Duplicate alert */}
            <AnimatePresence>
              {duplicateAlert && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest leading-none">Duplicate Entry Detected</p>
                      <p className="text-xs text-amber-700 font-bold mt-1.5">
                        <span className="font-black">{duplicateAlert.category}</span> on <span className="font-black">{formatDate(duplicateAlert.date)}</span> already exists — Rs. {parseFloat(duplicateAlert.amount).toLocaleString()}
                        {duplicateAlert.remarks && <span className="italic opacity-70"> · {duplicateAlert.remarks}</span>}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => loadForEdit(duplicateAlert)}
                          className="flex-1 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest py-2 px-3 rounded-xl hover:bg-amber-600 transition-colors"
                        >
                          Edit Existing
                        </button>
                        <button
                          onClick={addAnywayAndSave}
                          className="flex-1 bg-white border border-amber-200 text-amber-700 text-[10px] font-black uppercase tracking-widest py-2 px-3 rounded-xl hover:bg-amber-50 transition-colors"
                        >
                          Add Anyway
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            <form onSubmit={handleSave} className="space-y-6">
               <div>
                 <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">Expense Amount</label>
                 <div className="relative group">
                   <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                     <span className="text-slate-400 font-black text-xs">PKR</span>
                   </div>
                   <input 
                    type="number" 
                    required 
                    value={formData.amount} 
                    onChange={e => setFormData({...formData, amount: e.target.value})} 
                    className="w-full bg-slate-50 border border-transparent group-focus-within:border-indigo-100 group-focus-within:bg-white pl-14 pr-4 py-4 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 transition-all text-xl font-black text-slate-900 outline-none" 
                    placeholder="0.00" 
                   />
                 </div>
               </div>

               <div>
                 <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">Category / Head</label>
                 <select required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-slate-100 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none">
                   <option value="">-- Assign a Category --</option>
                   {heads.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                 </select>
                 {heads.length === 0 && <p className="text-[10px] font-black text-red-500 mt-2 uppercase tracking-wide">Please create Expense Heads first.</p>}
               </div>

               <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">Transaction Date</label>
                    <div 
                      className="relative cursor-pointer group"
                      onClick={() => {
                        if (dateRef.current && 'showPicker' in HTMLInputElement.prototype) {
                          dateRef.current.showPicker();
                        }
                      }}
                    >
                      <input 
                        type="text" 
                        readOnly 
                        value={formData.date ? formatDate(formData.date) : ''} 
                        placeholder="DD-MM-YYYY"
                        className="w-full bg-slate-50 border border-transparent group-hover:border-slate-200 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all cursor-pointer" 
                      />
                      <input 
                        type="date" 
                        ref={dateRef}
                        required 
                        value={formData.date} 
                        onChange={e => setFormData({...formData, date: e.target.value})} 
                        className="absolute inset-0 opacity-0 pointer-events-none" 
                      />
                    </div>
                  </div>
                 <div>
                   <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">Payment Mode</label>
                   <select value={formData.payment_mode} onChange={e => setFormData({...formData, payment_mode: e.target.value})} className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-slate-100 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all">
                     <option value="Cash">Cash</option>
                     <option value="Bank">Bank Deposit/Transfer</option>
                     <option value="Cheque">Cheque</option>
                   </select>
                 </div>
               </div>

               <div>
                 <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">Remarks / Details</label>
                 <textarea rows={3} value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-slate-100 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all resize-none" placeholder="E.g., Paid electric bill for month of March..."></textarea>
               </div>

               <div className="pt-4">
                 <button type="submit" disabled={loading} className="w-full bg-slate-900 border border-slate-800 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-50">
                   {loading ? 'Saving...' : editingId ? <><Save className="w-5 h-5" /> Update Entry</> : <><Save className="w-5 h-5" /> Commit to Ledger</>}
                 </button>
               </div>
            </form>
         </motion.div>

         {/* Latest Records Panel - Aura Style */}
         <div className="lg:col-span-2 space-y-8">
            <div className="bg-gradient-to-tr from-rose-600 to-rose-700 border border-rose-500 rounded-3xl p-10 flex flex-col md:flex-row items-center justify-between shadow-2xl shadow-rose-200">
               <div>
                  <h3 className="text-white font-black text-xl uppercase tracking-tighter">Daily Cash Liquidity Outflow</h3>
                  <p className="text-rose-100/70 text-[10px] font-black uppercase tracking-[0.2em] mt-1 italic">Real-time Financial Surveillance</p>
               </div>
               <div className="text-right mt-6 md:mt-0 flex flex-col items-end">
                  <span className="text-4xl md:text-5xl font-black text-white tracking-tighter font-display">
                    PKR {todayTotal.toLocaleString()}
                  </span>
                  <div className="w-12 h-1 bg-white/20 mt-3 rounded-full"></div>
               </div>
            </div>

            <div className="aura-card overflow-hidden border-none shadow-2xl shadow-slate-200/50">
               <div className="bg-slate-50/50 border-b border-slate-100 px-8 py-5">
                 <h3 className="text-[10px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.25em]"><Calendar className="w-4 h-4" /> Activity Feed</h3>
               </div>
               <table className="w-full text-left">
                 <thead>
                   <tr className="bg-white border-b border-slate-50">
                     <th className="p-6 text-premium-label">Historical Date</th>
                     <th className="p-6 text-premium-label">Accounting Head</th>
                     <th className="p-6 text-premium-label">Transaction Narrative</th>
                     <th className="p-6 text-premium-label text-right">Debit Amount</th>
                     <th className="p-6 text-premium-label text-center">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {recentExpenses.length === 0 ? <tr><td colSpan={5} className="p-20 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest italic opacity-50">No recent ledger activity detected.</td></tr> :
                     recentExpenses.map((exp, i) => (
                       <motion.tr 
                         key={exp.id} 
                         initial={{ opacity: 0, y: 10 }}
                         animate={{ opacity: 1, y: 0 }}
                         transition={{ delay: 0.3 + (i * 0.05) }}
                         whileHover={{ scale: 1.002, x: 5 }}
                         className="hover:bg-rose-50/30 transition-all group"
                       >
                         <td className="p-6 text-slate-900 font-bold text-xs uppercase tracking-tight whitespace-nowrap">{formatDate(exp.date)}</td>
                         <td className="p-6">
                            <span className="bg-slate-100 text-slate-700 font-black px-3 py-1 rounded-lg text-[9px] uppercase tracking-widest group-hover:bg-white transition-colors">{exp.category}</span>
                         </td>
                         <td className="p-6 text-slate-500 text-xs font-medium max-w-[200px] truncate" title={exp.remarks}>{exp.remarks || '—'}</td>
                         <td className="p-6 text-right font-black text-rose-600 text-sm whitespace-nowrap tracking-tight">Rs. {exp.amount.toLocaleString()}</td>
                         <td className="p-6 text-center">
                           <div className="flex items-center justify-center gap-1">
                             <button
                               onClick={() => loadForEdit(exp)}
                               className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all active:scale-90"
                               title="Edit this entry"
                             >
                               <Pencil className="w-4 h-4" />
                             </button>
                             <button
                               onClick={() => setDeleteModal({ isOpen: true, id: exp.id, name: `${exp.category} (Rs. ${exp.amount})` })}
                               className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all active:scale-90"
                               title="Delete this entry"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                           </div>
                         </td>
                       </motion.tr>
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
