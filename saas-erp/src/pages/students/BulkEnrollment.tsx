import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Upload, AlertCircle, CheckCircle, ArrowRight, Save, 
  FileSpreadsheet, Database, Table, Zap, RefreshCw, X
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types & Constants ────────────────────────────────────────────────────────

const DB_COLUMNS = [
  { key: 'full_name', label: 'Full Name', required: true, aliases: ['name', 'student name', 'full name'] },
  { key: 'roll_number', label: 'Roll Number', required: true, aliases: ['roll', 'roll no', 'reg no', 'id'] },
  { key: 'b_form_cnic', label: 'B-Form / CNIC', aliases: ['cnic', 'bform', 'b-form', 'id card'] },
  { key: 'dob', label: 'Date of Birth', aliases: ['birth', 'dob', 'date of birth', 'birth date'] },
  { key: 'gender', label: 'Gender', aliases: ['sex', 'gender'] },
  { key: 'admission_date', label: 'Admission Date', aliases: ['adm date', 'date of admission', 'admission date', 'joining date'] },
  { key: 'father_name', label: 'Father Name', aliases: ['father', 'parent name', 'father name', 'guardian name'] },
  { key: 'father_contact', label: 'Father Mobile (WhatsApp)', aliases: ['father mobile', 'father whatsapp', 'father phone', 'mobile', 'phone', 'contact', 'whatsapp', 'mobile number'] },
  { key: 'father_cnic', label: "Father's CNIC", aliases: ['father cnic', 'father id', 'f cnic', 'f id'] },
  { key: 'mother_name', label: 'Mother Name', aliases: ['mother', 'mother name'] },
  { key: 'mother_contact', label: 'Mother Mobile', aliases: ['mother mobile', 'mother phone', 'mother whatsapp'] },
  { key: 'emergency_contact', label: 'Emergency Mobile', aliases: ['emergency', 'emergency phone', 'emergency mobile', 'emergency contact'] },
  { key: 'address', label: 'Address', aliases: ['residencial address', 'home', 'address', 'current address'] },
  { key: 'fee_waiver_percentage', label: 'Waiver %', aliases: ['discount', 'waiver', 'scholarship', 'free', 'percentage', 'discount %'] },
  { key: 'guardian_name', label: 'Guardian Name', aliases: ['guardian', 'guardian name', 'caretaker'] },
  { key: 'guardian_cnic', label: 'Guardian CNIC', aliases: ['guardian cnic', 'guardian id', 'g cnic'] },
  { key: 'student_unique_id', label: 'Registration Number', aliases: ['reg number', 'registration number', 'reg no', 'admission no', 'admission number'] },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const parseDate = (val: string) => {
  if (!val) return null;
  // Try common formats
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  
  // Try DD-MM-YYYY
  const parts = val.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) { // YYYY last
       const d2 = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
       if (!isNaN(d2.getTime())) return d2.toISOString().split('T')[0];
    }
  }
  return val; // Fallback
};

// ── Component ────────────────────────────────────────────────────────────────

export default function BulkEnrollment() {
  const { userRole } = useAuth();
  
  // State
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, siblingsAutoGrouped: 0 });

  // ── Enrollment Logic ───────────────────────────────────────────────────────

  const processHeaders = (fields: string[], data: any[]) => {
    setHeaders(fields);
    setParsedData(data);
    // Auto-Mapping
    const auto: Record<string, string> = {};
    fields.forEach(hdr => {
      const match = DB_COLUMNS.find(col =>
        col.key === hdr.toLowerCase().replace(/ /g, '_') ||
        col.aliases.includes(hdr.toLowerCase().trim())
      );
      if (match) auto[hdr] = match.key;
    });
    setMapping(auto);
    setStep(2);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel';

    if (isXlsx) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = new Uint8Array(ev.target!.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          if (jsonData.length === 0) {
            setError('Excel file is empty or has no data rows.');
            return;
          }
          const fields = Object.keys(jsonData[0]);
          // Convert all values to strings for consistency
          const normalized = jsonData.map(row => {
            const r: Record<string, string> = {};
            fields.forEach(f => { r[f] = String(row[f] ?? ''); });
            return r;
          });
          processHeaders(fields, normalized);
        } catch (err: any) {
          setError('Failed to read Excel file: ' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // CSV
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (!results.meta.fields) {
            setError('Invalid CSV format: No headers found.');
            return;
          }
          processHeaders(results.meta.fields, results.data);
        }
      });
    }
  };

  const runEnrollment = async () => {
    if (!selectedClassId) {
      setError('Please select a target class first.');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      // 1. Sanitize & Group by Father (Family Logic)
      const families: Record<string, any[]> = {};
      parsedData.forEach((row, idx) => {
        const student: any = { school_id: userRole!.school_id, class_id: selectedClassId, status: 'active' };
        
        (Object.entries(mapping) as [string, string][]).forEach(([csvH, dbK]) => {
          let val: any = (row as Record<string, string | undefined>)[csvH]?.trim();
          if (!val) return;
          
          if (dbK === 'dob' || dbK === 'admission_date') val = parseDate(val);
          if (dbK === 'roll_number') val = parseInt(val) || (1000 + idx);
          if (dbK === 'fee_waiver_percentage') {
            const num = parseInt(val);
            val = isNaN(num) ? (val.toLowerCase() === 'free' ? 100 : 0) : Math.min(100, Math.max(0, num));
          }
          
          student[dbK] = val;
        });

        if (!student.full_name || student.full_name === 'undefined') {
          student.full_name = `Student ${student.roll_number || idx + 1}`;
        }

        // Family Key: Primary Phone + Father CNIC for absolute uniqueness
        const famKey = `${student.father_contact || ''}_${student.father_cnic || ''}` || student.father_name || 'Individual';
        if (!families[famKey]) families[famKey] = [];
        families[famKey].push(student);
      });

      let totalProcessed = 0;
      let siblingGroups = 0;

      // 2. Loop & Insert
      for (const [key, siblings] of Object.entries(families)) {
        const first = siblings[0];
        // 1. Find or Create Family Group
        let familyGroupId = '';
        let parentId = '';

        // Check by phone or CNIC
        const { data: existingParents } = await supabase
          .from('parents')
          .select('id, family_group_id')
          .eq('school_id', userRole!.school_id)
          .or(`whatsapp_number.eq.${first.father_contact},father_cnic.eq.${first.father_cnic}`)
          .maybeSingle();

        if (existingParents) {
          parentId = existingParents.id;
          familyGroupId = existingParents.family_group_id;
          // Update guardian info if provided
          if (first.guardian_name || first.guardian_cnic) {
            await supabase.from('parents').update({
              guardian_name: first.guardian_name || undefined,
              guardian_cnic: first.guardian_cnic || undefined,
              is_father_guardian: (first.guardian_name === first.father_name && first.guardian_cnic === first.father_cnic)
            }).eq('id', parentId);
          }
        } else {
          // Create Master Family Group
          const { data: fg, error: fgE } = await supabase.from('family_groups').insert({
            school_id: userRole!.school_id,
            family_name: `${first.father_name || first.full_name}'s Family`,
            primary_contact: first.father_name || first.full_name,
            primary_phone: first.father_contact || ''
          }).select().single();

          if (fgE) throw fgE;
          familyGroupId = fg.id;

          // Create Parent Account
          const fatherInit = (first.father_name || 'Parent').split(' ')[0].toLowerCase();
          const { data: parent, error: pE } = await supabase.from('parents').insert({
            school_id: userRole!.school_id,
            family_group_id: familyGroupId,
            family_number: `${fatherInit}${Math.random().toString(36).substring(7)}`,
            auth_password: `${fatherInit}123`,
            full_name: first.father_name || 'Parent',
            father_name: first.father_name || '',
            father_cnic: first.father_cnic || '',
            mother_name: first.mother_name || '',
            guardian_name: first.guardian_name || first.father_name || '',
            guardian_cnic: first.guardian_cnic || first.father_cnic || '',
            is_father_guardian: !first.guardian_name || (first.guardian_name === first.father_name && first.guardian_cnic === first.father_cnic),
            whatsapp_number: first.father_contact || '',
            emergency_mobile: first.emergency_contact || first.mother_contact || '',
            address: first.address || ''
          }).select().single();

          if (pE) throw pE;
          parentId = parent.id;
        }

        // 2. Insert/Upsert Students
        for (const s of siblings) {
          const { father_name, father_contact, father_cnic, mother_name, mother_contact, ...remainder } = s;
          
          // Check if student exists by Registration Number (student_unique_id)
          if (s.student_unique_id) {
            const { data: existingStudent } = await supabase
              .from('students')
              .select('id')
              .eq('school_id', userRole!.school_id)
              .eq('student_unique_id', s.student_unique_id)
              .maybeSingle();
            
            if (existingStudent) {
              // Update existing student
              await supabase.from('students').update({
                ...remainder,
                parent_id: parentId,
                family_group_id: familyGroupId
              }).eq('id', existingStudent.id);
              totalProcessed++;
              continue;
            }
          }

          // Insert new student
          const sNameInit = s.full_name.split(' ')[0].toLowerCase();
          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          const studentUniqueId = s.student_unique_id || `${sNameInit}${s.roll_number || randomSuffix}-${Math.floor(Math.random() * 900)}`;

          const { error: sE } = await supabase.from('students').insert({
            ...remainder,
            parent_id: parentId,
            family_group_id: familyGroupId,
            student_unique_id: studentUniqueId,
            auth_password: `${sNameInit}123`,
            fee_waiver_percentage: s.fee_waiver_percentage || 0
          });
          if (sE) throw sE;
          totalProcessed++;
        }
        if (siblings.length > 1) siblingGroups++;
      }

      setStats({ total: totalProcessed, siblingsAutoGrouped: siblingGroups });
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchCls = async () => {
      const { data } = await supabase.from('classes').select('id, name, section').eq('school_id', userRole?.school_id);
      if (data) setClasses(data);
    };
    if (userRole?.school_id) fetchCls();
  }, [userRole?.school_id]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      
      {/* HUD Bar */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500 flex items-center justify-center text-white shadow-lg shadow-violet-100">
            <Database className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 uppercase tracking-tight">Mass Enrollment Protocol</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Excel & CSV Nexus</p>
          </div>
        </div>

        <div className="flex gap-1">
          {[1, 2, 3].map(s => (
            <div 
              key={s}
              className={cn(
                "h-1.5 w-12 rounded-full transition-all duration-500",
                step === s ? "bg-violet-600" : step > s ? "bg-emerald-500" : "bg-slate-100"
              )}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        
        {/* STEP 1: UPLOAD */}
        {step === 1 && (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="ent-card py-16 flex flex-col items-center justify-center text-center border-dashed border-2 border-slate-200"
          >
            <div className="w-20 h-20 bg-violet-50 rounded-full flex items-center justify-center mb-6">
              <FileSpreadsheet className="w-10 h-10 text-violet-600" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tighter">Initialize Payload</h2>
            <p className="text-sm text-slate-400 font-medium mb-8 max-w-sm">
              Upload your Student Spreadsheet. We'll attempt to auto-detect columns like Name, Father, Phone, and Dates.
            </p>
            
            <label className="ent-btn-primary px-10 cursor-pointer">
              <Upload className="w-4 h-4 mr-2" /> Select CSV / Excel File
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
            </label>
          </motion.div>
        )}

        {/* STEP 2: MAPPING */}
        {step === 2 && (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 ent-card">
                <p className="ent-label">Coordinate Alignment</p>
                <div className="overflow-x-auto">
                  <table className="ent-table">
                    <thead>
                      <tr>
                        <th>Excel Column</th>
                        <th>Nexus Field</th>
                      </tr>
                    </thead>
                    <tbody>
                      {headers.map(hdr => (
                        <tr key={hdr}>
                          <td className="font-bold text-slate-700">{hdr}</td>
                          <td>
                            <select 
                              value={mapping[hdr] || ''}
                              onChange={e => setMapping({...mapping, [hdr]: e.target.value})}
                              className="ent-input py-1 text-xs w-full"
                            >
                              <option value="">Ignore</option>
                              {DB_COLUMNS.map(c => (
                                <option key={c.key} value={c.key}>{c.label}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4">
                <div className="ent-card">
                  <p className="ent-label">Deployment Targets</p>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Destination Class</label>
                  <select 
                    value={selectedClassId}
                    onChange={e => setSelectedClassId(e.target.value)}
                    className="ent-input w-full mb-4"
                  >
                    <option value="">Select Class...</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}-{c.section}</option>
                    ))}
                  </select>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex justify-between items-center text-xs">
                       <span className="text-slate-400 font-bold uppercase">Rows Detected</span>
                       <span className="font-black text-slate-900">{parsedData.length}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                       <span className="text-slate-400 font-bold uppercase">Fields Mapped</span>
                       <span className="font-black text-emerald-600">{Object.keys(mapping).length}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button 
                    onClick={runEnrollment}
                    disabled={isLoading || !selectedClassId}
                    className="w-full ent-btn-primary py-4 shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {isLoading ? "IMPORTING..." : "START ENROLLMENT"}
                  </button>
                  <button onClick={() => setStep(1)} className="ent-btn-ghost text-[10px] font-black uppercase">Cancel & Reset</button>
                </div>
              </div>
            </div>
            
            {error && (
              <div className="ent-card border-red-200 bg-red-50 py-3 flex items-center gap-3 text-red-700">
                <AlertCircle className="w-4 h-4" />
                <p className="text-xs font-bold leading-tight">{error}</p>
              </div>
            )}
          </motion.div>
        )}

        {/* STEP 3: SUMMARY */}
        {step === 3 && (
          <motion.div 
            key="step3"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="ent-card py-20 text-center"
          >
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tighter">nexus synchronized</h2>
            <p className="text-sm text-slate-400 font-medium mb-8">
              Database successfully updated with <span className="text-indigo-600 font-black">{stats.total}</span> new student records.<br/>
              Detected <span className="text-emerald-600 font-black">{stats.siblingsAutoGrouped}</span> sibling families and linked them automatically.
            </p>
            
            <div className="flex items-center justify-center gap-4">
              <button 
                onClick={() => { setStep(1); setParsedData([]); }}
                className="ent-btn-ghost px-8"
              >
                Upload Another
              </button>
              <button 
                onClick={() => window.location.href='/students'}
                className="ent-btn-primary px-8"
              >
                View Directory
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
