import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Settings, PlusCircle, Trash2, Save, X, Network, BookOpen, AlertCircle } from 'lucide-react';

export default function FeeCriteria() {
  const { userRole } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [editingClassId, setEditingClassId] = useState('');
  const [matrix, setMatrix] = useState<any>({ recurrent: [], first_time: [] });

  useEffect(() => {
    if (userRole?.school_id) fetchConfig();
  }, [userRole]);

  const fetchConfig = async () => {
    setLoading(true);
    // Fetch all classes
    const { data: clsData } = await supabase.from('classes').select('*').eq('school_id', userRole?.school_id).order('name');
    if (clsData) setClasses(clsData);

    // Fetch structures
    const { data: stData } = await supabase.from('fee_structures').select('*').eq('school_id', userRole?.school_id);
    if (stData) setStructures(stData);

    setLoading(false);
  };

  const getActiveStructure = (classId: string) => {
    return structures.find(s => s.class_id === classId);
  };

  const openEditor = (classObj: any) => {
    setEditingClassId(classObj.id);
    const existing = getActiveStructure(classObj.id);
    if (existing && existing.fee_matrix) {
       setMatrix(existing.fee_matrix);
    } else {
       // Init default empty matrix if none exists
       setMatrix({
         recurrent: [{ item: 'Monthly Tuition Fee', amount: 0 }],
         first_time: [{ item: 'Admission Fee', amount: 0 }, { item: 'Security Deposit', amount: 0 }]
       });
    }
  };

  const handleSaveMatrix = async () => {
    try {
      const existing = getActiveStructure(editingClassId);
      
      // Calculate total amount for legacy fallback column
      let legacyTotal = 0;
      matrix.recurrent.forEach((i:any) => legacyTotal += i.amount);

      if (existing) {
         const { error } = await supabase.from('fee_structures').update({
           amount: legacyTotal,
           fee_matrix: matrix
         }).eq('id', existing.id);
         if (error) throw error;
      } else {
         const { error } = await supabase.from('fee_structures').insert([{
           school_id: userRole?.school_id,
           class_id: editingClassId,
           amount: legacyTotal,
           fee_matrix: matrix
         }]);
         if (error) throw error;
      }

      alert('Class Fee Matrix successfully locked in!');
      setEditingClassId('');
      fetchConfig();
    } catch (err: any) { alert(err.message); }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Network className="w-6 h-6 text-indigo-600" /> Dynamic Fee Packages</h1>
          <p className="text-gray-500 text-sm mt-1">Configure advanced recurrent tuition and first-time admission heads natively class-by-class.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {/* CLASS LIST PANEL */}
         <div className="md:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4 h-[650px] overflow-y-auto">
            <h3 className="font-bold text-gray-800 pb-3 mb-3 border-b border-gray-200">Select a Class</h3>
            {loading ? <p className="text-center p-4 text-gray-500 text-sm">Loading...</p> : 
             classes.length === 0 ? <p className="text-center p-4 text-gray-500 text-sm">No classes created yet. Setup Academics first.</p> :
             <div className="space-y-2">
                {classes.map(c => {
                   const hasConfig = getActiveStructure(c.id);
                   return (
                     <button key={c.id} onClick={() => openEditor(c)} className={`w-full text-left p-3 rounded-lg border transition-colors flex justify-between items-center ${editingClassId === c.id ? 'bg-indigo-50 border-indigo-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                        <div>
                           <p className="font-bold text-gray-900 text-sm">{c.name} - {c.section}</p>
                           <p className={`text-xs mt-1 ${hasConfig ? 'text-green-600 font-medium' : 'text-red-500 inline-flex items-center gap-1'}`}>
                             {hasConfig ? 'Configured' : <><AlertCircle className="w-3 h-3"/> Unconfigured</>}
                           </p>
                        </div>
                        <Settings className={`w-4 h-4 ${editingClassId === c.id ? 'text-indigo-600' : 'text-gray-400'}`} />
                     </button>
                   );
                })}
             </div>
            }
         </div>

         {/* EDITOR PANEL */}
         <div className="md:col-span-2 bg-gray-50 rounded-xl shadow-inner border border-gray-300 flex flex-col overflow-hidden h-[650px]">
            {!editingClassId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                 <BookOpen className="w-16 h-16 mb-4 opacity-30" />
                 <p className="text-lg">Select a class from the left to configure its fee matrix.</p>
              </div>
            ) : (
              <>
                 <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center shrink-0">
                    <div>
                      <h3 className="font-black text-indigo-900 text-lg uppercase tracking-wider">Fee Architect</h3>
                      <p className="text-xs text-gray-500 font-medium">Class: {classes.find(c=>c.id===editingClassId)?.name} - {classes.find(c=>c.id===editingClassId)?.section}</p>
                    </div>
                    <button onClick={handleSaveMatrix} className="bg-indigo-600 text-white px-6 py-2 flex items-center gap-2 rounded-lg font-bold shadow hover:bg-indigo-700">
                      <Save className="w-5 h-5"/> Deploy Matrix
                    </button>
                 </div>

                 <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    
                    {/* FIRST TIME HEADS */}
                    <div className="bg-white rounded-xl shadow-sm border border-orange-200 p-5">
                       <div className="flex justify-between items-center mb-4">
                         <div>
                            <h4 className="font-black text-orange-800 text-sm uppercase">First-Time Admission Charges</h4>
                            <p className="text-xs text-gray-500">Billed only once when "Include Admission Headers" is checked.</p>
                         </div>
                         <button onClick={() => setMatrix({...matrix, first_time: [...matrix.first_time, {item:'New Cost', amount:0}]})} className="text-orange-600 hover:text-orange-800 text-xs font-bold flex items-center gap-1 bg-orange-50 px-3 py-1.5 rounded-full"><PlusCircle className="w-3 h-3"/> Add Row</button>
                       </div>
                       
                       <div className="space-y-3">
                          {matrix.first_time.map((row:any, idx:number) => (
                             <div key={idx} className="flex gap-3 items-center bg-gray-50 p-2 rounded border border-gray-200">
                               <input type="text" value={row.item} onChange={(e) => {
                                  const arr = [...matrix.first_time]; arr[idx].item = e.target.value; setMatrix({...matrix, first_time:arr});
                               }} className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm font-medium" placeholder="Head Name" />
                               
                               <div className="relative w-40">
                                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs text-gray-500">PKR</div>
                                 <input type="number" value={row.amount} onChange={(e) => {
                                    const arr = [...matrix.first_time]; arr[idx].amount = parseFloat(e.target.value)||0; setMatrix({...matrix, first_time:arr});
                                 }} className="w-full pl-10 pr-3 py-1.5 border border-gray-300 rounded text-sm text-right font-bold focus:ring-orange-500" />
                               </div>

                               <button onClick={() => {
                                  const arr = matrix.first_time.filter((_:any, i:number) => i!==idx); setMatrix({...matrix, first_time:arr});
                               }} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-5 h-5"/></button>
                             </div>
                          ))}
                          {matrix.first_time.length === 0 && <p className="text-xs text-gray-400 italic">No first-time charges configured.</p>}
                       </div>
                    </div>

                    {/* RECURRENT HEADS */}
                    <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-5">
                       <div className="flex justify-between items-center mb-4">
                         <div>
                            <h4 className="font-black text-blue-800 text-sm uppercase">Recurrent Monthly Standard Billing</h4>
                            <p className="text-xs text-gray-500">Fixed costs billed on every standard invoice cycle.</p>
                         </div>
                         <button onClick={() => setMatrix({...matrix, recurrent: [...matrix.recurrent, {item:'New Cost', amount:0}]})} className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full"><PlusCircle className="w-3 h-3"/> Add Row</button>
                       </div>
                       
                       <div className="space-y-3">
                          {matrix.recurrent.map((row:any, idx:number) => (
                             <div key={idx} className="flex gap-3 items-center bg-gray-50 p-2 rounded border border-gray-200">
                               <input type="text" value={row.item} onChange={(e) => {
                                  const arr = [...matrix.recurrent]; arr[idx].item = e.target.value; setMatrix({...matrix, recurrent:arr});
                               }} className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm font-medium" placeholder="Head Name" />
                               
                               <div className="relative w-40">
                                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs text-gray-500">PKR</div>
                                 <input type="number" value={row.amount} onChange={(e) => {
                                    const arr = [...matrix.recurrent]; arr[idx].amount = parseFloat(e.target.value)||0; setMatrix({...matrix, recurrent:arr});
                                 }} className="w-full pl-10 pr-3 py-1.5 border border-gray-300 rounded text-sm text-right font-bold focus:ring-blue-500" />
                               </div>

                               <button onClick={() => {
                                  const arr = matrix.recurrent.filter((_:any, i:number) => i!==idx); setMatrix({...matrix, recurrent:arr});
                               }} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-5 h-5"/></button>
                             </div>
                          ))}
                          {matrix.recurrent.length === 0 && <p className="text-xs text-gray-400 italic">No recurrent strings configured. Usually contains Tuition.</p>}
                       </div>
                    </div>

                 </div>
              </>
            )}
         </div>
      </div>
    </div>
  );
}
