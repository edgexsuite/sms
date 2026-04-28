import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  FileText, Printer, Users, Plus, Trash2, 
  Layout, ArrowLeft, School
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';

interface Column {
  id: string;
  label: string;
  maxMarks: string;
}

export default function AwardListGenerator() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [examTypes, setExamTypes] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [listTitle, setListTitle] = useState('Oral Examination Marking Sheet');
  
  const [columns, setColumns] = useState<Column[]>([
    { id: '1', label: 'Rhymes', maxMarks: '30' },
    { id: '2', label: 'G.K.', maxMarks: '30' },
    { id: '3', label: 'Adab-e-Zindagi', maxMarks: '30' }
  ]);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchInitialData();
    }
  }, [userRole?.school_id]);

  useEffect(() => {
    if (selectedClass) {
      fetchStudents();
    }
  }, [selectedClass]);

  const fetchInitialData = async () => {
    const [{ data: school }, { data: cls }, { data: exams }] = await Promise.all([
      supabase.from('schools').select('*').eq('id', userRole?.school_id).single(),
      supabase.from('classes').select('id, name, section').eq('school_id', userRole?.school_id).order('name'),
      supabase.from('exam_types').select('id, name, session').eq('school_id', userRole?.school_id).order('created_at', { ascending: false })
    ]);
    if (school) setSchoolInfo(school);
    if (cls) setClasses(cls);
    if (exams) setExamTypes(exams);
  };

  const fetchStudents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('students')
      .select('id, full_name, roll_number')
      .eq('class_id', selectedClass)
      .eq('status', 'active')
      .order('roll_number');
    if (data) setStudents(data);
    setLoading(false);
  };

  const addColumn = () => {
    const newId = Date.now().toString();
    setColumns([...columns, { id: newId, label: 'New Column', maxMarks: '100' }]);
  };

  const removeColumn = (id: string) => {
    if (columns.length > 1) {
      setColumns(columns.filter(c => c.id !== id));
    }
  };

  const updateColumn = (id: string, field: keyof Column, value: string) => {
    setColumns(columns.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handlePrint = () => {
    window.print();
  };

  // ── Pagination Logic ───────────────────────────────────────────────────────
  const CHUNK_SIZE = 25;
  const studentChunks = [];
  const displayStudents = students.length > 0 ? students : Array.from({ length: 25 }, (_, i) => ({ id: `blank-${i}`, full_name: '', roll_number: '' }));
  
  for (let i = 0; i < displayStudents.length; i += CHUNK_SIZE) {
    studentChunks.push(displayStudents.slice(i, i + CHUNK_SIZE));
  }

  const currentClass = classes.find(c => c.id === selectedClass);
  const currentExam = examTypes.find(e => e.id === selectedExam);
  const grandTotalMaxMarks = columns.reduce((sum, col) => sum + (Number(col.maxMarks) || 0), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <style>{`
        @media print {
          /* Hide EVERYTHING by default during print */
          body * { visibility: hidden; }
          /* Show ONLY the print-area and its children */
          .print-area, .print-area * { visibility: visible; }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            display: block !important;
          }
          .no-print { display: none !important; }
          
          .page-break:not(:last-child) {
            page-break-after: always;
          }
          .page-break {
            min-height: 297mm;
            padding: 10mm 12mm;
            box-sizing: border-box;
            background: white;
            position: relative;
            display: flex;
            flex-direction: column;
            page-break-inside: avoid;
          }
          
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
        @media screen {
          .print-area { display: none; }
        }
      `}</style>

      {/* ── Dashboard UI (no-print) ── */}
      <div className="no-print space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </button>
            <div>
              <h1 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 flex items-center gap-2">
                <FileText className="w-8 h-8 text-indigo-600" />
                Award List Generator
              </h1>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Generate printable examination marking sheets</p>
            </div>
          </div>
          <button
            onClick={handlePrint}
            disabled={!selectedClass && students.length === 0}
            className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Print Marking Sheet
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Configuration */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Class Context</label>
                <select
                  value={selectedClass}
                  onChange={e => setSelectedClass(e.target.value)}
                  className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-100 p-3.5 rounded-2xl text-sm font-bold text-slate-700 transition-all outline-none"
                >
                  <option value="">Select Class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Examination</label>
                <select
                  value={selectedExam}
                  onChange={e => setSelectedExam(e.target.value)}
                  className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-100 p-3.5 rounded-2xl text-sm font-bold text-slate-700 transition-all outline-none"
                >
                  <option value="">Select Exam (Optional)</option>
                  {examTypes.map(e => <option key={e.id} value={e.id}>{e.name} ({e.session})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sheet Title</label>
                <input
                  type="text"
                  value={listTitle}
                  onChange={e => setListTitle(e.target.value)}
                  placeholder="e.g. Oral Examination Marking Sheet"
                  className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-100 p-3.5 rounded-2xl text-sm font-bold text-slate-700 transition-all outline-none"
                />
              </div>
            </div>

            <div className="bg-indigo-900 rounded-[2.5rem] p-6 text-white space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Layout className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <h4 className="font-black italic uppercase tracking-tighter">Pro Tip</h4>
                  <p className="text-[10px] text-indigo-200 font-medium leading-tight">These sheets are best printed on A4 paper. Use 'Portrait' orientation.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Dynamic Columns */}
          <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black italic uppercase tracking-tighter text-slate-900">Customize Columns</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Define your marking criteria</p>
              </div>
              <button
                onClick={addColumn}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all"
              >
                <Plus className="w-3 h-3" /> Add Column
              </button>
            </div>

            <div className="space-y-3">
              {columns.map((col, index) => (
                <div key={col.id} className="group flex items-center gap-4 bg-slate-50 p-4 rounded-3xl transition-all hover:bg-slate-100">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-100">
                    {index + 1}
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      value={col.label}
                      onChange={e => updateColumn(col.id, 'label', e.target.value)}
                      placeholder="Column Label"
                      className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 placeholder:text-slate-300"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-300 uppercase shrink-0">Max Marks:</span>
                      <input
                        type="text"
                        value={col.maxMarks}
                        onChange={e => updateColumn(col.id, 'maxMarks', e.target.value)}
                        className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-black text-center text-slate-600 outline-none focus:border-indigo-300 transition-all"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => removeColumn(col.id)}
                    className="p-2 text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-slate-100">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Preview Summary</p>
               <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase">Sr. No.</span>
                  <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase">Student Name</span>
                  {columns.map(c => (
                    <span key={c.id} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold uppercase">
                      {c.label} ({c.maxMarks})
                    </span>
                  ))}
                  <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase">Total Marks</span>
                  <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase">Obtained Marks</span>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Print Area (High Fidelity with Pagination) ── */}
      <div className="print-area hidden">
        {studentChunks.map((chunk, chunkIndex) => (
          <div key={chunkIndex} className="page-break">
            {/* Header Section */}
            <div className="flex items-start justify-between border-b-2 border-black pb-4 mb-6 relative">
              <div className="w-24 h-24 shrink-0 overflow-hidden">
                {schoolInfo?.logo_url ? (
                  <img src={schoolInfo.logo_url} alt="logo" className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full bg-slate-100 rounded-xl flex items-center justify-center">
                    <School className="w-10 h-10 text-slate-300" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 text-center px-4">
                <h1 className="text-2xl font-bold uppercase tracking-tight text-black">{schoolInfo?.name || 'School Name'}</h1>
                <p className="text-sm font-medium text-black mt-1">{schoolInfo?.address || 'School Location'}</p>
                <h2 className="text-lg font-black uppercase tracking-widest mt-4 text-black underline underline-offset-4">{listTitle}</h2>
                {currentExam && <p className="text-xs font-bold text-black mt-0.5">{currentExam.name} ({currentExam.session})</p>}
              </div>

              <div className="w-32 pt-1">
                <div className="border border-black p-1.5 text-center bg-slate-50">
                   <p className="text-[9px] font-bold uppercase text-black">Grade / Class</p>
                   <p className="text-xs font-black text-black">{currentClass ? `${currentClass.name} ${currentClass.section}` : 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Table Section */}
            <table className="w-full border-collapse border-2 border-black text-xs font-medium">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border-[1.5px] border-black p-2 text-center w-12 font-bold">Sr.no.</th>
                  <th className="border-[1.5px] border-black p-2 text-left font-bold">Student Name</th>
                  {columns.map(col => (
                    <th key={col.id} className="border-[1.5px] border-black p-2 text-center w-24 font-bold">
                      {col.label} ({col.maxMarks})
                    </th>
                  ))}
                  <th className="border-[1.5px] border-black p-2 text-center w-24 font-bold">Total Obt. Marks</th>
                  <th className="border-[1.5px] border-black p-2 text-center w-20 font-bold">Total Marks</th>
                </tr>
              </thead>
              <tbody>
                {chunk.map((stu, i) => {
                  const srNo = chunkIndex * CHUNK_SIZE + i + 1;
                  return (
                    <tr key={stu.id} className="h-8 group">
                      <td className="border-[1.5px] border-black p-1 text-center">{srNo}</td>
                      <td className="border-[1.5px] border-black p-1 font-bold uppercase text-[10px]">
                        {stu.full_name} {stu.roll_number && <span className="text-[7px] font-normal text-slate-400">(#{stu.roll_number})</span>}
                      </td>
                      {columns.map(col => <td key={col.id} className="border-[1.5px] border-black"></td>)}
                      <td className="border-[1.5px] border-black"></td>
                      <td className="border-[1.5px] border-black text-center font-bold">{grandTotalMaxMarks}</td>
                    </tr>
                  );
                })}
                {/* Pad with empty rows if it's the last page and has less than 25 students */}
                {chunkIndex === studentChunks.length - 1 && chunk.length < CHUNK_SIZE && Array.from({ length: CHUNK_SIZE - chunk.length }).map((_, i) => (
                  <tr key={`extra-${i}`} className="h-8">
                    <td className="border-[1.5px] border-black p-1 text-center">{chunkIndex * CHUNK_SIZE + chunk.length + i + 1}</td>
                    <td className="border-[1.5px] border-black p-1"></td>
                    {columns.map(col => <td key={col.id} className="border-[1.5px] border-black"></td>)}
                    <td className="border-[1.5px] border-black"></td>
                    <td className="border-[1.5px] border-black text-center font-bold">{grandTotalMaxMarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Footer Section (Signatures on EVERY page) */}
            <div className="mt-auto pt-6">
              <div className="flex justify-between items-end px-4 mb-2">
                <div className="text-center">
                  <div className="w-40 border-b-2 border-black mb-1"></div>
                  <p className="text-[10px] font-bold uppercase text-black">Teacher's Signature</p>
                </div>
                <div className="text-center">
                  <div className="w-40 border-b-2 border-black mb-1"></div>
                  <p className="text-[10px] font-bold uppercase text-black">Examination Incharge</p>
                </div>
                <div className="text-center">
                  <div className="w-40 border-b-2 border-black mb-1"></div>
                  <p className="text-[10px] font-bold uppercase text-black">Principal / Director</p>
                </div>
              </div>
              
              <div className="px-4 pb-0 flex justify-between items-center text-[10px] font-black text-black uppercase tracking-widest mt-4">
                <span>Page {chunkIndex + 1} / {studentChunks.length}</span>
                <span className="italic opacity-40 text-[7px]">Printed by EdgeX Digital Solutions</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
