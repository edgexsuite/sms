import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Upload, AlertCircle, CheckCircle, ArrowRight, Save, FileSpreadsheet, TrendingDown, ChevronLeft } from 'lucide-react';
import Papa from 'papaparse';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';

export default function BulkExpenseImport() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [heads, setHeads] = useState<any[]>([]);
  
  // Mapping state: CSV Header -> Database Column
  const [mapping, setMapping] = useState<Record<string, string>>({});
  
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fields for expenses
  const dbColumns = [
    { key: 'date', label: 'Date (YYYY-MM-DD) *' },
    { key: 'category', label: 'Expense Head / Category *' },
    { key: 'amount', label: 'Amount *' },
    { key: 'payment_mode', label: 'Payment Mode (Cash/Bank/Cheque)' },
    { key: 'remarks', label: 'Description / Remarks' },
  ];

  useEffect(() => {
    if (userRole?.school_id) {
      fetchHeads();
    }
  }, [userRole]);

  const fetchHeads = async () => {
    const { data } = await supabase.from('expense_heads').select('name').eq('school_id', userRole?.school_id);
    if (data) setHeads(data.map(h => h.name));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setError('');

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.meta.fields || results.meta.fields.length === 0) {
          setError('CSV file appears to be empty or has no headers.');
          return;
        }
        setHeaders(results.meta.fields);
        setParsedData(results.data);
        
        // Auto-mapping logic
        const autoMap: Record<string, string> = {};
        results.meta.fields.forEach(header => {
          const matchedDbCol = dbColumns.find(col => col.key.replace(/_/g, '').toLowerCase() === header.replace(/[_ ]/g, '').toLowerCase());
          if (matchedDbCol) autoMap[header] = matchedDbCol.key;
        });
        setMapping(autoMap);
        setStep(2);
      },
      error: (err: any) => {
        setError('Error parsing file: ' + err.message);
      }
    });
  };

  const executeBulkInsert = async () => {
    if (!userRole?.school_id) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const inserts = parsedData.map(row => {
        const payload: Record<string, any> = {
          school_id: userRole.school_id,
          type: 'expense',
          is_deleted: false,
          payment_mode: 'Cash'
        };

        // Construct payload based on mapping
        (Object.entries(mapping) as [string, string][]).forEach(([csvHeader, dbCol]) => {
          if (row[csvHeader]) {
             if (dbCol === 'amount') payload[dbCol] = parseFloat(row[csvHeader]);
             else payload[dbCol] = row[csvHeader];
          }
        });

        // Ensure required fields
        if (!payload.date) throw new Error('Missing Date in row data.');
        if (!payload.amount) throw new Error('Missing Amount in row data.');
        if (!payload.category) throw new Error('Missing Category/Head in row data.');

        return payload;
      });

      // Verify categories exist? (Optional, but good for UX)
      const uniqueCats = Array.from(new Set(inserts.map(i => i.category)));
      const missingCats = uniqueCats.filter(c => !heads.includes(c));
      
      if (missingCats.length > 0) {
        throw new Error(`The following categories don't exist in your Expense Heads: ${missingCats.join(', ')}. Please create them first or fix the CSV.`);
      }

      const { error: insertError } = await supabase.from('financial_transactions').insert(inserts);
      if (insertError) throw insertError;

      setSuccess(`Successfully imported ${inserts.length} expense records!`);
      setStep(3);
    } catch (err: any) {
      console.error('Bulk Expense Error:', err);
      setError(err.message || 'Failed to bulk insert records.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-aura-in">
      <div className="flex items-center justify-between">
        <div>
           <button onClick={() => navigate('/expenses/add-daily')} className="flex items-center gap-1 text-xs font-black text-slate-400 uppercase tracking-widest mb-2 hover:text-slate-900 transition-colors">
              <ChevronLeft className="w-3 h-3" /> Back to Ledger
           </button>
           <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tighter">
             <TrendingDown className="w-8 h-8 text-rose-600" /> Bulk Expense Migration
           </h1>
           <p className="text-slate-500 text-sm font-bold mt-1 opacity-70 uppercase tracking-widest">Migrate historical financial data from legacy systems.</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex border-b border-slate-100">
        <div className={`px-6 py-4 font-black text-[10px] uppercase tracking-[0.2em] border-b-2 transition-all ${step === 1 ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-400'}`}>1. Data Upload</div>
        <div className={`px-6 py-4 font-black text-[10px] uppercase tracking-[0.2em] border-b-2 transition-all ${step === 2 ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-400'}`}>2. Field Alignment</div>
        <div className={`px-6 py-4 font-black text-[10px] uppercase tracking-[0.2em] border-b-2 transition-all ${step === 3 ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-400'}`}>3. Sync Complete</div>
      </div>

      <div className="aura-card border-none shadow-2xl shadow-slate-200/50 p-10">
        {error && (
          <div className="mb-8 bg-red-50 border border-red-100 p-5 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <p className="text-[10px] font-black uppercase tracking-widest text-red-700">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-8 bg-emerald-50 border border-emerald-100 p-5 rounded-2xl flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5" />
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">{success}</p>
          </div>
        )}

        {step === 1 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center p-16 border-4 border-dashed border-slate-100 rounded-[2rem] bg-slate-50/30"
          >
            <div className="w-20 h-20 bg-white rounded-3xl shadow-xl shadow-slate-200/50 flex items-center justify-center mb-6">
                <FileSpreadsheet className="w-10 h-10 text-rose-500" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">Select Migration File</h3>
            <p className="text-xs text-slate-400 font-bold text-center max-w-md mb-8 uppercase tracking-widest leading-relaxed">Ensure your CSV contains columns for Date, Amount, and Category. We'll handle the mapping next.</p>
            <label className="cursor-pointer bg-slate-900 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] hover:bg-black transition-all flex items-center gap-3 shadow-xl active:scale-95">
              <Upload className="w-5 h-5" /> Browse CSV Library
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            </label>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="bg-rose-50 border border-rose-100 p-6 rounded-2xl">
              <h3 className="text-xs font-black text-rose-900 mb-2 uppercase tracking-widest">Alignment Protocols</h3>
              <p className="text-xs text-rose-800 font-medium opacity-80 uppercase tracking-tight">We detected {headers.length} unique headers. Map them precisely to ensure ledger integrity. Unmapped columns will be discarded.</p>
            </div>

            <div className="border border-slate-100 rounded-[1.5rem] overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="p-6 text-premium-label w-1/2">Legacy Header</th>
                    <th className="p-6 text-premium-label w-1/2">System Projection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {headers.map((header) => (
                    <tr key={header} className="hover:bg-slate-50 transition-colors">
                      <td className="p-6 font-black text-slate-900 text-xs uppercase tracking-tight">{header}</td>
                      <td className="p-6">
                        <select
                          value={mapping[header] || ''}
                          onChange={(e) => setMapping({...mapping, [header]: e.target.value})}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-rose-500/10 transition-all appearance-none cursor-pointer"
                        >
                          <option value="">-- Discard Column --</option>
                          {dbColumns.map(col => (
                            <option key={col.key} value={col.key}>{col.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-6 gap-4">
              <button onClick={() => setStep(1)} className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">
                Cancel
              </button>
              <button onClick={executeBulkInsert} disabled={loading} className="px-10 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black flex items-center gap-3 shadow-xl active:scale-95 disabled:opacity-50">
                 {loading ? 'Processing Protocol...' : 'Initiate ledger injection'} <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-50">
              <CheckCircle className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-tight">Sync Complete</h2>
            <p className="text-xs text-slate-500 font-bold mb-10 max-w-sm mx-auto uppercase tracking-widest leading-relaxed">The historical financial entries have been successfully committed to the primary ledger.</p>
            <div className="flex justify-center gap-6">
              <button onClick={() => { setStep(1); setFile(null); setParsedData([]); }} className="px-8 py-4 bg-slate-100 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95">
                New Session
              </button>
              <button onClick={() => navigate('/expenses/reports')} className="px-8 py-4 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 shadow-xl shadow-rose-200 transition-all active:scale-95">
                View Reports
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
