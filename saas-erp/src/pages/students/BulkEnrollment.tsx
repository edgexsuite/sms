import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Upload, AlertCircle, CheckCircle, ArrowRight, Save, FileSpreadsheet } from 'lucide-react';
import Papa from 'papaparse';

export default function BulkEnrollment() {
  const { userRole } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  
  // Mapping state: CSV Header -> Database Column
  const [mapping, setMapping] = useState<Record<string, string>>({});
  
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Core system fields that can be mapped
  const dbColumns = [
    { key: 'full_name', label: 'Full Name (Required)' },
    { key: 'roll_number', label: 'Roll Number (Required)' },
    { key: 'b_form_cnic', label: 'B-Form / CNIC' },
    { key: 'dob', label: 'Date of Birth (YYYY-MM-DD)' },
    { key: 'gender', label: 'Gender (Male/Female)' },
    { key: 'class_id', label: 'Class ID (UUID)' },
    { key: 'parent_family_number', label: 'Family Number / Parent ID' },
  ];

  useEffect(() => {
    if (userRole?.school_id) {
      fetchClasses();
    }
  }, [userRole]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name, section').eq('school_id', userRole?.school_id);
    if (data) setClasses(data);
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
          status: 'active'
        };

        // Construct payload based on mapping
        (Object.entries(mapping) as [string, string][]).forEach(([csvHeader, dbCol]: [string, string]) => {
          if (row[csvHeader]) {
             if (dbCol === 'roll_number') (payload as any)[dbCol] = parseInt(row[csvHeader], 10);
             else if (dbCol !== 'parent_family_number') (payload as any)[dbCol] = row[csvHeader];
          }
        });

        // Ensure required fields
        if (!payload.full_name) throw new Error('Missing Full Name in row data.');
        if (!payload.roll_number) throw new Error(`Missing Roll Number for student: ${payload.full_name}`);
        
        // Generate memorable credentials if missing
        if (!payload.student_unique_id) {
          const suffix = Math.floor(1000 + Math.random() * 9000).toString();
          const namePart = (payload.full_name || 'Student').trim().split(' ')[0];
          payload.student_unique_id = `${namePart}${suffix}`;
        }
        if (!payload.auth_password) {
          payload.auth_password = Math.random().toString(36).slice(-6).toUpperCase();
        }
        if (payload.fee_waiver_percentage === undefined) {
          payload.fee_waiver_percentage = 0;
        }

        return payload;
      });

      const { error: insertError } = await supabase.from('students').insert(inserts);
      if (insertError) throw insertError;

      setSuccess(`Successfully enrolled ${inserts.length} students!`);
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Failed to bulk insert records.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Advanced Bulk Enrollment</h1>
        <p className="text-gray-500 text-sm mt-1">Map your existing spreadsheet columns directly to the new database structure.</p>
      </div>

      {/* Progress Steps */}
      <div className="flex border-b border-gray-200">
        <div className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${step === 1 ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>1. Upload File</div>
        <div className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${step === 2 ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>2. Map Columns</div>
        <div className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${step === 3 ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>3. Finalize</div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-8">
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded-r-md flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
            <FileSpreadsheet className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Upload CSV or Excel File</h3>
            <p className="text-sm text-gray-500 text-center max-w-md mb-6">Ensure your file has a header row. We will map your columns in the next step.</p>
            <label className="cursor-pointer bg-blue-600 text-white px-6 py-2.5 rounded-md font-medium hover:bg-blue-700 transition flex items-center gap-2">
              <Upload className="w-4 h-4" /> Browse Files
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-md">
              <h3 className="font-semibold text-blue-900 mb-1">Column Mapping</h3>
              <p className="text-sm text-blue-800">We detected {headers.length} columns in your file. Please map them to match our database. Unmapped columns will be ignored.</p>
            </div>

            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="p-4 font-medium text-gray-700 w-1/2">Your CSV Header</th>
                    <th className="p-4 font-medium text-gray-700 w-1/2">Database Field</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {headers.map((header) => (
                    <tr key={header} className="hover:bg-gray-50 focus-within:bg-blue-50">
                      <td className="p-4 font-medium text-gray-900">{header}</td>
                      <td className="p-4">
                        <select
                          value={mapping[header] || ''}
                          onChange={(e) => setMapping({...mapping, [header]: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                          <option value="">-- Ignore this column --</option>
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

            <div className="flex justify-end pt-4">
              <button onClick={() => setStep(1)} className="px-6 py-2 text-gray-700 mr-4 font-medium hover:bg-gray-100 rounded-md">
                Back
              </button>
              <button onClick={executeBulkInsert} disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50">
                 {loading ? 'Processing...' : 'Run Enrollment'} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Enrollment Complete!</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">The batch processing finished successfully and data is now populated.</p>
            <div className="flex justify-center gap-4">
              <button onClick={() => { setStep(1); setFile(null); setParsedData([]); }} className="px-6 py-2 bg-gray-100 text-gray-700 rounded-md font-medium hover:bg-gray-200 transition">
                Upload Another
              </button>
              <a href="/students" className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 inline-block transition">
                View Student List
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
