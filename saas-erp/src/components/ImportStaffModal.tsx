import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  X, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  Table as TableIcon,
  FileSpreadsheet,
  Trash2
} from 'lucide-react';

interface ImportStaffModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportStaffModal({ onClose, onSuccess }: ImportStaffModalProps) {
  const { userRole } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const dbColumns = [
    { key: 'full_name', label: 'Full Name (Required)' },
    { key: 'role', label: 'Role (Required)' },
    { key: 'department', label: 'Department' },
    { key: 'qualification', label: 'Qualification' },
    { key: 'cnic', label: 'CNIC' },
    { key: 'whatsapp_number', label: 'Mobile Number / WhatsApp' },
    { key: 'email', label: 'Email' },
    { key: 'salary', label: 'Salary / Rate' },
    { key: 'employment_type', label: 'Employment Type (full-time/visiting)' },
    { key: 'payment_basis', label: 'Payment Basis (monthly/per-lecture/per-day)' },
    { key: 'joining_date', label: 'Joining Date (YYYY-MM-DD)' },
    { key: 'dob', label: 'DOB (YYYY-MM-DD)' },
    { key: 'gender', label: 'Gender' },
    { key: 'address', label: 'Address' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setError('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (data.length < 2) {
          setError('File appears to be empty or missing headers.');
          return;
        }

        const head = data[0] as string[];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

        setHeaders(head);
        setParsedData(rows);

        // Auto-mapping logic
        const autoMap: Record<string, string> = {};
        head.forEach(h => {
          const match = dbColumns.find(col => 
            col.key.toLowerCase().replace(/_/g, '') === h.toLowerCase().replace(/[_ ]/g, '') ||
            col.label.toLowerCase().includes(h.toLowerCase())
          );
          if (match) autoMap[h] = match.key;
        });
        setMapping(autoMap);
        setStep(2);
      } catch (err: any) {
        setError('Failed to parse Excel file: ' + err.message);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleImport = async () => {
    if (!userRole?.school_id) return;
    setLoading(true);
    setError('');

    try {
      const inserts = parsedData.map((row, idx) => {
        const payload: any = { school_id: userRole.school_id, is_active: true };

        (Object.entries(mapping) as Array<[string, string]>).forEach(([excelHeader, dbCol]) => {
          if (!dbCol) return;
          if (row[excelHeader] !== undefined && row[excelHeader] !== null) {
            let val = row[excelHeader];
            
            // Handle numeric / date conversions
            if (dbCol === 'salary') val = parseFloat(val) || 0;
            if (dbCol === 'joining_date' || dbCol === 'dob') {
              if (val instanceof Date) {
                val = val.toISOString().split('T')[0];
              } else if (typeof val === 'string' && val.trim() !== '') {
                // Handle DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY formats
                const cleaned = val.trim();
                const separatorMatch = cleaned.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
                if (separatorMatch) {
                  const [, d, m, y] = separatorMatch;
                  val = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                }
                // Handle YYYY-MM-DD (already correct) — no change needed
                // Handle Excel serial date numbers
              } else if (typeof val === 'number') {
                // Excel serial date → JS Date → ISO string
                const excelEpoch = new Date(1899, 11, 30);
                const jsDate = new Date(excelEpoch.getTime() + val * 86400000);
                val = jsDate.toISOString().split('T')[0];
              } else {
                val = null;
              }
            }

            payload[dbCol] = val;
          } else {
            // Default to null if column is not present or is empty/null
            payload[dbCol] = null;
          }
        });

        if (!payload.full_name) throw new Error(`Row ${idx + 2}: Missing Full Name`);
        if (!payload.role) throw new Error(`Row ${idx + 2}: Missing Role`);

        return payload;
      });

      const { error: insertError } = await supabase.from('staff').insert(inserts);
      if (insertError) throw insertError;

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Bulk import failed.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-800 px-6 py-4 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-black text-white flex items-center gap-2 tracking-tight">
            <FileSpreadsheet className="w-5 h-5 text-indigo-400" /> BATCH STAFF INGESTION
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
        </div>

        {/* Wizard Steps */}
        <div className="flex bg-slate-50 border-b border-slate-200 shrink-0">
          {[
            { id: 1, label: 'Upload Data' },
            { id: 2, label: 'Column Mapping' },
            { id: 3, label: 'Success' }
          ].map(s => (
            <div key={s.id} className={`px-8 py-3 text-xs font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${step === s.id ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === s.id ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{s.id}</span>
              {s.label}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-sm font-bold text-red-800">{error}</p>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col items-center justify-center p-16 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50 hover:bg-slate-50 hover:border-indigo-300 transition-all group">
              <div className="bg-white p-5 rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-10 h-10 text-indigo-600" />
              </div>
              <h4 className="text-xl font-black text-slate-900 mb-2">Drop your spreadsheet here</h4>
              <p className="text-slate-500 text-sm font-medium mb-8">Supports Microsoft Excel (.xlsx) and CSV files.</p>
              
              <label className="cursor-pointer bg-indigo-600 px-8 py-3 rounded-xl text-white font-black text-sm hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200">
                Browse Files
                <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileChange} />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-center gap-4">
                <TableIcon className="w-8 h-8 text-indigo-600 shrink-0" />
                <div>
                  <h5 className="font-bold text-indigo-900">Map your Spreadsheet Columns</h5>
                  <p className="text-xs text-indigo-700 font-medium">Link each Excel header to its database counterpart. Unlinked columns will be skipped.</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Excel Header</th>
                      <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">System Field</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {headers.map(h => (
                      <tr key={h} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-700">{h}</td>
                        <td className="px-6 py-4">
                          <select 
                            value={mapping[h] || ''} 
                            onChange={e => setMapping({...mapping, [h]: e.target.value})}
                            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 w-full outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">-- Skip this column --</option>
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

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button onClick={() => setStep(1)} className="px-6 py-3 text-slate-500 font-black text-sm hover:text-slate-700">Go Back</button>
                <button 
                  onClick={handleImport} 
                  disabled={loading}
                  className="bg-indigo-600 px-8 py-3 rounded-xl text-white font-black text-sm hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? 'Processing Batch...' : 'Begin Import'} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
