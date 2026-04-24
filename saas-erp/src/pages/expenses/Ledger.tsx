import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BookOpen, Calendar, ArrowUpRight, ArrowDownRight, Wallet, Printer } from 'lucide-react';

export default function Ledger() {
  const { userRole } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [dateType, setDateType] = useState('today'); // 'today', 'month', 'all', 'custom'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Editing State
  const [editingTx, setEditingTx] = useState<any | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState({ date: '', amount: '', description: '' });

  useEffect(() => {
    if (userRole?.school_id) fetchLedger();
  }, [userRole, dateType, customStart, customEnd]);

  const fetchLedger = async () => {
    setLoading(true);
    let startD = new Date();
    let endD = new Date();
    
    if (dateType === 'today') {
       startD.setHours(0,0,0,0);
       endD.setHours(23,59,59,999);
    } else if (dateType === 'month') {
       startD.setDate(1);
       startD.setHours(0,0,0,0);
       endD.setHours(23,59,59,999);
    } else if (dateType === 'custom' && customStart && customEnd) {
       startD = new Date(customStart);
       endD = new Date(customEnd);
       endD.setHours(23,59,59,999);
    }

    try {
      // 1. Fetch Expenses from literal transactions table
      let expenseQuery = supabase.from('financial_transactions')
        .select('*')
        .eq('school_id', userRole?.school_id)
        .eq('type', 'expense');
        
      if (dateType !== 'all') {
         expenseQuery = expenseQuery.gte('date', startD.toISOString().split('T')[0])
                                    .lte('date', endD.toISOString().split('T')[0]);
      }
      const { data: expData } = await expenseQuery;

      // 2. Fetch Income from financial_transactions (written by EasyFee, Fees, Payroll)
      let incomeQuery = supabase.from('financial_transactions')
        .select('*')
        .eq('school_id', userRole?.school_id)
        .eq('type', 'income');

      if (dateType !== 'all') {
         incomeQuery = incomeQuery.gte('date', startD.toISOString().split('T')[0])
                                  .lte('date', endD.toISOString().split('T')[0]);
      }
      const { data: incData } = await incomeQuery;

      // 3. Stitch them together into a unified chronological array
      const unifiedArray: any[] = [];

      if (expData) {
        expData.forEach(e => {
          unifiedArray.push({
            id: e.id,
            date: e.date,
            real_time: new Date(e.date).getTime(),
            type: 'expense',
            amount: parseFloat(e.amount),
            mode: e.payment_mode,
            description: e.remarks || `Expense: ${e.category}`,
            ref: e.category
          });
        });
      }

      if (incData) {
        incData.forEach(i => {
           unifiedArray.push({
             id: i.id,
             date: i.date,
             real_time: new Date(i.date).getTime(),
             type: 'income',
             amount: parseFloat(i.amount),
             mode: i.payment_mode || 'Cash',
             description: i.remarks || `Income: ${i.category}`,
             ref: i.category || 'FEE'
           });
        });
      }

      // Sort chronological descending
      unifiedArray.sort((a,b) => b.real_time - a.real_time);
      setTransactions(unifiedArray);

    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (t: any) => {
    setEditingTx(t);
    setEditForm({
      date: t.date,
      amount: String(t.amount),
      description: t.description
    });
  };

  const handleUpdateTx = async () => {
    if (!editingTx || !editForm.amount || !editForm.date) return;
    setEditLoading(true);

    try {
      const { error } = await supabase
        .from('financial_transactions')
        .update({
          amount: parseFloat(editForm.amount),
          date: editForm.date,
          remarks: editForm.description
        })
        .eq('id', editingTx.id);

      if (error) throw error;

      // ── SMART SYNC: Update Fee Record if this is a Fee Collection ────
      if (editingTx.category === 'Fee Collection') {
        // Find invoice number in remarks: "Fee — Student (Month) · INV-1001"
        const invoiceMatch = editForm.description.match(/INV-\d+/);
        if (invoiceMatch) {
          await supabase.from('fee_records').update({
            paid_amount: parseFloat(editForm.amount),
            paid_at: editForm.date + 'T12:00:00Z',
          }).eq('invoice_number', invoiceMatch[0]);
        }
      }
      
      setEditingTx(null);
      await fetchLedger();
    } catch (err: any) {
      alert('Error updating transaction: ' + err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const handlePrint = () => window.print();

  // Metrics
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netCash = totalIncome - totalExpense;

  return (
    <>
    <div className="space-y-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; margin: 0; padding: 0; }
          .ledger-print { width: 100%; border-collapse: collapse; font-size: 11px; }
          .ledger-print th, .ledger-print td { border: 1px solid #ddd; padding: 6px; }
        }
      `}</style>
      
      <div className="no-print max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><BookOpen className="w-6 h-6 text-indigo-600" /> Unified Day Book Ledger</h1>
            <p className="text-gray-500 text-sm mt-1">All-in-one financial sheet. Computes gross income, expenditures, and net cash-in-hand dynamically.</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex items-center bg-white border border-gray-300 rounded-md p-1 shadow-sm">
               <button onClick={() => setDateType('today')} className={`px-4 py-1.5 text-sm font-medium rounded ${dateType === 'today' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>Today</button>
               <button onClick={() => setDateType('month')} className={`px-4 py-1.5 text-sm font-medium rounded ${dateType === 'month' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>This Month</button>
               <button onClick={() => setDateType('all')} className={`px-4 py-1.5 text-sm font-medium rounded ${dateType === 'all' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>Lifetime</button>
               <button onClick={() => setDateType('custom')} className={`px-4 py-1.5 text-sm font-medium rounded flex items-center gap-1 ${dateType === 'custom' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}><Calendar className="w-4 h-4"/> Custom</button>
             </div>
             <button onClick={handlePrint} className="bg-indigo-600 text-white p-2.5 rounded-md hover:bg-indigo-700 shadow-sm" title="Print Ledger"><Printer className="w-5 h-5"/></button>
          </div>
        </div>

        {dateType === 'custom' && (
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex gap-4 items-center">
            <span className="text-sm font-bold text-gray-600">Select Range:</span>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="border border-gray-300 px-3 py-1.5 rounded text-sm focus:ring-indigo-500" />
            <span className="text-gray-400">to</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="border border-gray-300 px-3 py-1.5 rounded text-sm focus:ring-indigo-500" />
          </div>
        )}

        {/* METRICS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10"><ArrowUpRight className="w-16 h-16 text-green-500" /></div>
             <span className="text-sm font-bold text-gray-500 uppercase tracking-widest block mb-2">Total Income</span>
             <h3 className="text-4xl font-black text-green-600">Rs. {totalIncome.toLocaleString()}</h3>
             <p className="text-xs text-gray-400 mt-2 font-medium">As per selected date range</p>
           </div>
           
           <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10"><ArrowDownRight className="w-16 h-16 text-red-500" /></div>
             <span className="text-sm font-bold text-gray-500 uppercase tracking-widest block mb-2">Total Expense</span>
             <h3 className="text-4xl font-black text-red-600">Rs. {totalExpense.toLocaleString()}</h3>
             <p className="text-xs text-gray-400 mt-2 font-medium">As per selected date range</p>
           </div>

           <div className="bg-indigo-600 rounded-xl shadow-lg border border-indigo-700 p-6 flex flex-col justify-between relative overflow-hidden text-white">
             <div className="absolute top-0 right-0 p-4 opacity-20"><Wallet className="w-16 h-16 text-white" /></div>
             <span className="text-sm font-bold text-indigo-200 uppercase tracking-widest block mb-2">Net Cash In Hand</span>
             <h3 className="text-4xl font-black text-white">Rs. {netCash.toLocaleString()}</h3>
             <p className="text-xs text-indigo-300 mt-2 font-medium">Liquid available gross profit</p>
           </div>
        </div>

        {/* LEDGER TABLE */}
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
             <h3 className="font-bold text-gray-800">Chronological Transactions List</h3>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-white border-b border-gray-100">
              <tr>
                <th className="p-4 font-medium text-gray-500">Date Logged</th>
                <th className="p-4 font-medium text-gray-500">REF/Type</th>
                <th className="p-4 font-medium text-gray-500 w-1/3">Detailed Description</th>
                <th className="p-4 font-medium text-gray-500">Pay Mode</th>
                <th className="p-4 font-medium text-gray-500 text-right">Debit (In)</th>
                <th className="p-4 font-medium text-gray-500 text-right">Credit (Out)</th>
                <th className="p-4 font-medium text-gray-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
               {loading ? <tr><td colSpan={7} className="p-8 text-center text-gray-400 font-sans">Compiling Day Book...</td></tr> : 
                transactions.length === 0 ? <tr><td colSpan={7} className="p-12 text-center text-gray-400 font-sans">No transactions recorded for this period.</td></tr> :
                transactions.map((t, index) => {
                  // Running balance calculation (since sorted descending, we reverse compute or just skip for simplicity, but let's do a gross balance visual)
                  return (
                    <tr key={index} className="hover:bg-gray-50 transition-colors text-xs">
                      <td className="p-4 text-gray-500 whitespace-nowrap">{t.date}</td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${t.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {t.ref}
                        </span>
                      </td>
                      <td className="p-4 text-gray-700 font-sans">{t.description}</td>
                      <td className="p-4 text-gray-500">{t.mode}</td>
                      <td className="p-4 text-right font-bold text-green-600">{t.type === 'income' ? t.amount.toLocaleString() : '-'}</td>
                      <td className="p-4 text-right font-bold text-red-600">{t.type === 'expense' ? t.amount.toLocaleString() : '-'}</td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => openEditModal(t)}
                          className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 transition-colors"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  )
                })
               }
            </tbody>
          </table>
        </div>
      </div>

      {/* PRINT-ONLY UI */}
      <div className="print-only" style={{ display: 'none' }}>
         <h1 style={{ textAlign: 'center', fontFamily: 'sans-serif' }}>Unified Day Book Ledger</h1>
         <p style={{ textAlign: 'center', fontFamily: 'sans-serif', fontSize: '12px' }}>Generated on {new Date().toLocaleDateString()}</p>
         
         <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'sans-serif', marginTop: '20px', marginBottom: '20px' }}>
            <div><strong>Total Income:</strong> Rs. {totalIncome.toLocaleString()}</div>
            <div><strong>Total Expenses:</strong> Rs. {totalExpense.toLocaleString()}</div>
            <div><strong>Net Cash:</strong> Rs. {netCash.toLocaleString()}</div>
         </div>

         <table className="ledger-print font-mono text-left">
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th>Date</th>
                <th>Type / Ref</th>
                <th>Description</th>
                <th>Mode</th>
                <th>Credit (In)</th>
                <th>Debit (Out)</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, idx) => (
                <tr key={idx}>
                  <td>{t.date}</td>
                  <td>{t.ref.substring(0, 15)}</td>
                  <td>{t.description}</td>
                  <td>{t.mode}</td>
                  <td style={{ color: t.type==='income' ? 'green' : 'black'}}>{t.type === 'income' ? t.amount.toLocaleString() : ''}</td>
                  <td style={{ color: t.type==='expense' ? 'red' : 'black'}}>{t.type === 'expense' ? t.amount.toLocaleString() : ''}</td>
                </tr>
              ))}
            </tbody>
         </table>
      </div>

      </div>

      {/* EDIT MODAL */}
      {editingTx && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-900">Edit Transaction</h3>
              <button onClick={() => setEditingTx(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Transaction Date</label>
                <input 
                  type="date" 
                  value={editForm.date} 
                  onChange={e => setEditForm({...editForm, date: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Amount (Rs)</label>
                <input 
                  type="number" 
                  value={editForm.amount} 
                  onChange={e => setEditForm({...editForm, amount: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-lg font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Description</label>
                <textarea 
                  value={editForm.description} 
                  onChange={e => setEditForm({...editForm, description: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs h-20 resize-none focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={handleUpdateTx}
                  disabled={editLoading}
                  className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100"
                >
                  {editLoading ? 'Updating...' : 'Save Changes'}
                </button>
                <button 
                  onClick={() => setEditingTx(null)}
                  className="px-4 py-3 border border-gray-200 text-gray-500 font-bold rounded-xl text-sm hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
