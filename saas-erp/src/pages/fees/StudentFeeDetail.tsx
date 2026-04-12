import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Search, Wallet, AlertCircle, Save, CheckCircle } from 'lucide-react';

export default function StudentFeeDetail() {
  const { userRole } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  
  // Student specific data
  const [invoices, setInvoices] = useState<any[]>([]);
  const [waiver, setWaiver] = useState<number>(0);
  
  // Partial Payment Modal State
  const [payingInvoice, setPayingInvoice] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState('Cash');

  useEffect(() => {
    if (userRole?.school_id) fetchStudents();
  }, [userRole]);

  const fetchStudents = async () => {
    const { data } = await supabase.from('students').select('*, classes(name)').eq('school_id', userRole?.school_id).eq('status', 'active');
    if (data) setStudents(data);
  };

  const selectStudent = async (stu: any) => {
    setSelectedStudent(stu);
    setWaiver(stu.fee_waiver_percentage || 0);

    const { data } = await supabase.from('fee_records').select('*').eq('student_id', stu.id).order('created_at', { ascending: false });
    if (data) setInvoices(data);
  };

  const handleUpdateWaiver = async () => {
    try {
       const { error } = await supabase.from('students').update({ fee_waiver_percentage: waiver }).eq('id', selectedStudent.id);
       if (error) throw error;
       alert('Waiver updated! Future generated invoices for this student will respect this override.');
       fetchStudents();
    } catch(err: any){ alert(err.message); }
  };

  const handleProcessPayment = async () => {
    if (paymentAmount <= 0) return alert('Enter a valid amount.');
    
    const maxPayable = payingInvoice.total_amount - (payingInvoice.paid_amount || 0);
    if (paymentAmount > maxPayable) return alert(`Payment cannot exceed remaining balance of Rs. ${maxPayable}`);

    const newPaidTotal = (payingInvoice.paid_amount || 0) + paymentAmount;
    let newStatus = 'pending';
    if (newPaidTotal >= payingInvoice.total_amount) newStatus = 'paid';
    else if (newPaidTotal > 0) newStatus = 'partially paid';

    try {
      // 1. Update Invoice Block
      const { error: invErr } = await supabase.from('fee_records').update({
        paid_amount: newPaidTotal,
        payment_mode: paymentMode,
        status: newStatus
      }).eq('id', payingInvoice.id);
      if (invErr) throw invErr;

      // 2. Synchronize to the Master Day Book (`financial_transactions`)
      const { error: transErr } = await supabase.from('financial_transactions').insert([{
         school_id: userRole?.school_id,
         type: 'income',
         amount: paymentAmount,
         payment_mode: paymentMode,
         category: 'Fee Collection',
         date: new Date().toISOString().split('T')[0],
         remarks: `Partial/Full payment towards ${payingInvoice.invoice_number} for ${selectedStudent.full_name}`
      }]);
      if (transErr) throw transErr;

      alert(`Successfully processed Rs. ${paymentAmount}. Synced strictly to Day Book.`);
      setPayingInvoice(null);
      setPaymentAmount(0);
      selectStudent(selectedStudent); // refresh their history
    } catch (err: any) { alert(err.message); }
  };


  const filteredStudents = students.filter(s => s.full_name.toLowerCase().includes(search.toLowerCase()) || s.roll_number.toString().includes(search));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Wallet className="w-6 h-6 text-green-600" /> Student Fee Ledger</h1>
           <p className="text-gray-500 text-sm mt-1">Accept partial or full payments. Manage custom discount waivers individually.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
         {/* Left Side: Directory */}
         <div className="w-full md:w-1/3 bg-white rounded-xl shadow-sm border border-gray-200 p-4 h-[700px] overflow-hidden flex flex-col">
            <div className="mb-4">
               <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                 <input type="text" placeholder="Search by name or roll..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded focus:ring-green-500 text-sm" />
               </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
               {filteredStudents.map(stu => (
                 <button key={stu.id} onClick={() => selectStudent(stu)} className={`w-full text-left p-3 rounded-lg border transition-colors flex justify-between items-center ${selectedStudent?.id === stu.id ? 'bg-green-50 border-green-300 text-green-900' : 'bg-gray-50 border-transparent hover:bg-gray-100 hover:border-gray-300 text-gray-700'}`}>
                    <div>
                      <p className="font-bold text-sm">{stu.full_name}</p>
                      <p className="text-xs opacity-70">Class: {stu.classes?.name} | Roll: {stu.roll_number}</p>
                    </div>
                    {stu.fee_waiver_percentage > 0 && <span className="bg-yellow-200 text-yellow-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{stu.fee_waiver_percentage}% Off</span>}
                 </button>
               ))}
            </div>
         </div>

         {/* Right Side: Detailed Ledger */}
         <div className="flex-1 bg-gray-50 rounded-xl shadow-inner border border-gray-300 h-[700px] flex flex-col overflow-hidden">
            {!selectedStudent ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                 <Search className="w-16 h-16 mb-4 opacity-30" />
                 <p className="text-lg">Locate a student to analyze their lifetime financial history.</p>
              </div>
            ) : (
              <>
                 <div className="bg-white border-b border-gray-200 p-6 shadow-sm z-10 shrink-0">
                    <div className="flex justify-between items-start">
                       <div>
                          <h2 className="text-2xl font-black text-gray-900 tracking-tight">{selectedStudent.full_name}</h2>
                          <p className="text-gray-500 font-medium text-sm mt-1">Roll No: {selectedStudent.roll_number} | Class: {selectedStudent.classes?.name}</p>
                       </div>
                       
                       <div className="border border-green-300 bg-green-50 rounded-lg p-3 w-64 shadow-inner">
                          <label className="block text-[10px] font-bold text-green-800 uppercase tracking-wider mb-1">Lifetime Discount Override</label>
                          <div className="flex items-center gap-2">
                             <div className="relative flex-1">
                               <input type="number" value={waiver} onChange={e=>setWaiver(parseFloat(e.target.value)||0)} className="w-full border border-green-300 py-1.5 px-3 rounded text-sm right-align pr-8 focus:ring-green-500 font-bold" />
                               <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
                             </div>
                             <button onClick={handleUpdateWaiver} className="bg-green-600 text-white px-3 py-1.5 rounded transition hover:bg-green-700 shadow"><Save className="w-4 h-4"/></button>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="flex-1 overflow-y-auto p-6">
                    <h3 className="font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">Lifetime Transaction Array</h3>
                    
                    {invoices.length === 0 ? <p className="text-center p-8 text-gray-500 italic">No invoices have been billed against this student yet.</p> : (
                       <div className="space-y-4">
                          {invoices.map(inv => {
                             const balance = inv.total_amount - (inv.paid_amount || 0);
                             const isPaid = balance <= 0;
                             
                             return (
                               <div key={inv.id} className={`bg-white border rounded-xl p-5 shadow-sm transition-all ${isPaid ? 'border-gray-200 opacity-75' : 'border-green-300 ring-2 ring-green-50'}`}>
                                  <div className="flex justify-between items-center mb-3">
                                     <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase">{new Date(inv.month_year).toLocaleString('default', {month:'long', year:'numeric'})}</p>
                                        <p className="font-mono text-sm font-bold text-gray-800">{inv.invoice_number}</p>
                                     </div>
                                     <div className="text-right">
                                        <span className={`px-2 py-1 text-[10px] uppercase font-black tracking-wider rounded-full ${isPaid ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-700'}`}>
                                          {isPaid ? 'Cleared' : (inv.paid_amount > 0 ? 'Partially Paid' : 'Pending')}
                                        </span>
                                     </div>
                                  </div>

                                  <div className="bg-gray-50 rounded p-3 mb-4 border border-gray-100 text-sm">
                                     <table className="w-full">
                                        <tbody>
                                           {(inv.breakdown || []).map((b:any, i:number) =>(
                                              <tr key={i} className="border-b border-gray-100 last:border-0"><td className="py-1 text-gray-600">{b.item}</td><td className="py-1 text-right font-medium">Rs. {b.amount}</td></tr>
                                           ))}
                                        </tbody>
                                     </table>
                                  </div>

                                  <div className="flex justify-between items-end border-t border-gray-100 pt-4 mt-2">
                                     <div className="space-y-1">
                                        <p className="text-xs font-medium text-gray-500">Gross Total: Rs. {inv.total_amount}</p>
                                        <p className="text-xs font-medium text-green-600">Total Paid: Rs. {inv.paid_amount || 0}</p>
                                        {!isPaid && <p className="text-sm font-black text-red-600 mt-1">Outstanding Balance: Rs. {balance}</p>}
                                     </div>
                                     
                                     {!isPaid ? (
                                        <button onClick={() => {setPayingInvoice(inv); setPaymentAmount(balance);}} className="bg-green-600 text-white px-5 py-2 rounded-lg font-bold shadow hover:bg-green-700 active:scale-95 transition-transform">
                                          Accept Receipt
                                        </button>
                                     ) : (
                                        <div className="text-gray-400 font-bold flex items-center gap-1"><CheckCircle className="w-5 h-5"/> Settled</div>
                                     )}
                                  </div>
                               </div>
                             );
                          })}
                       </div>
                    )}
                 </div>
              </>
            )}
         </div>
      </div>

      {/* PAYMENT MODAL */}
      {payingInvoice && (
         <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all">
               <div className="bg-green-600 px-6 py-4 flex justify-between items-center text-white">
                 <h3 className="font-bold text-lg flex items-center gap-2"><Wallet className="w-5 h-5"/> Collect Payment</h3>
               </div>
               
               <div className="p-6 space-y-5 bg-gray-50">
                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm text-center">
                     <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Max Collectable Balance</p>
                     <p className="text-3xl font-black text-gray-900">Rs. {payingInvoice.total_amount - (payingInvoice.paid_amount || 0)}</p>
                  </div>

                  <div>
                     <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Received Amount To Log</label>
                     <div className="relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">Rs.</span>
                       <input type="number" 
                          value={paymentAmount || ''} 
                          onChange={e => setPaymentAmount(parseFloat(e.target.value)||0)} 
                          className="w-full border-2 border-green-400 pl-10 pr-4 py-3 rounded-xl font-bold text-lg focus:ring-green-500 focus:border-green-500 shadow-inner" 
                       />
                     </div>
                     <p className="text-[10px] text-gray-500 mt-1 italic">You can edit this down to accept partial short-payments.</p>
                  </div>

                  <div>
                     <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Payment Mechanism</label>
                     <select value={paymentMode} onChange={e=>setPaymentMode(e.target.value)} className="w-full border border-gray-300 px-3 py-2 rounded-lg font-medium shadow-sm bg-white focus:ring-green-500">
                        <option>Cash Base</option>
                        <option>Bank Deposit</option>
                        <option>Cheque</option>
                        <option>Digital Transfer</option>
                     </select>
                  </div>
               </div>

               <div className="px-6 py-4 bg-white border-t border-gray-200 flex justify-end gap-3">
                  <button onClick={() => setPayingInvoice(null)} className="px-5 py-2 font-bold text-gray-500 hover:bg-gray-100 rounded-lg">Cancel Form</button>
                  <button onClick={handleProcessPayment} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md flex items-center gap-2">
                     Capture Funds
                  </button>
               </div>
            </div>
         </div>
      )}

    </div>
  );
}
