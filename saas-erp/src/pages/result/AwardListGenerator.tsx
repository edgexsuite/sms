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
  const [selectedSubject, setSelectedSubject] = useState('custom'); // 'custom', 'all', or subjectId
  const [listTitle, setListTitle] = useState('Examination Award List');
  
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [marksData, setMarksData] = useState<Record<string, Record<string, number>>>({}); // studentId -> { subjectId -> marks }
  
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
      fetchSubjects();
      setMarksData({});
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedClass && selectedExam) {
      fetchMarks();
    }
  }, [selectedClass, selectedExam]);

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

  const fetchSubjects = async () => {
    const { data } = await supabase
      .from('subjects')
      .select('id, subject_name, total_marks')
      .eq('class_id', selectedClass)
      .order('subject_name');
    if (data) setAllSubjects(data);
  };

  const fetchMarks = async () => {
    const { data } = await supabase
      .from('exam_results')
      .select('student_id, subject_id, obtained_marks')
      .eq('exam_type_id', selectedExam)
      .eq('school_id', userRole?.school_id);
    
    if (data) {
      const map: Record<string, Record<string, number>> = {};
      data.forEach(r => {
        if (!map[r.student_id]) map[r.student_id] = {};
        map[r.student_id][r.subject_id] = r.obtained_marks;
      });
      setMarksData(map);
    }
  };

  const handleSubjectChange = (val: string) => {
    setSelectedSubject(val);
    if (val === 'all') {
      setColumns(allSubjects.map(s => ({ id: s.id, label: s.subject_name, maxMarks: String(s.total_marks || 100) })));
      setListTitle(`Consolidated Award List — ${currentClass?.name || ''}`);
    } else if (val !== 'custom') {
      const sub = allSubjects.find(s => s.id === val);
      if (sub) {
        setColumns([{ id: sub.id, label: sub.subject_name, maxMarks: String(sub.total_marks || 100) }]);
        setListTitle(`${sub.subject_name} Award List`);
      }
    }
  };

  const addColumn = () => {
    const newId = Date.now().toString();
    setColumns([...columns, { id: newId, label: 'New Column', maxMarks: '100' }]);
  };

  const removeColumn = (id: string) => {
    setColumns(prev => prev.filter(c => c.id !== id));
  };

  const updateColumn = (id: string, field: keyof Column, value: string) => {
    setColumns(columns.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handlePrint = () => {
    window.print();
  };

  // ── Pagination Logic ───────────────────────────────────────────────────────
  const CHUNK_SIZE = 35; // Increased for narrow portrait copies
  const displayStudents = students.length > 0 ? students : Array.from({ length: CHUNK_SIZE }, (_, i) => ({ id: `blank-${i}`, full_name: '', roll_number: '' }));
  
  const currentClass = classes.find(c => c.id === selectedClass);
  const currentExam = examTypes.find(e => e.id === selectedExam);
  const grandTotalMaxMarks = columns.reduce((sum, col) => sum + (Number(col.maxMarks) || 0), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area {
            position: absolute; left: 0; top: 0; width: 100%; display: block !important;
          }
          .no-print { display: none !important; }
          .page-break {
            page-break-after: always; padding: 5mm; box-sizing: border-box; background: white;
            min-height: 297mm; page-break-inside: avoid;
          }
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          @page { size: A4 portrait; margin: 0; }
          .copy-divider {
            border-left: 1.5px dashed #ccc; height: 100%; position: absolute; left: 50%; top: 0; margin-left: -0.75px;
          }
        }
        @media screen { .print-area { display: none; } }
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
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Generate printable dual-copy award lists</p>
            </div>
          </div>
          <button
            onClick={handlePrint}
            disabled={!selectedClass && students.length === 0}
            className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Print Award Lists
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Subject Selection</label>
                <select
                  value={selectedSubject}
                  onChange={e => handleSubjectChange(e.target.value)}
                  disabled={!selectedClass}
                  className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-100 p-3.5 rounded-2xl text-sm font-bold text-slate-700 transition-all outline-none disabled:opacity-50"
                >
                  <option value="custom">Manual / Custom Columns</option>
                  <option value="all">— All Subjects —</option>
                  <optgroup label="Specific Subject">
                    {allSubjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sheet Title</label>
                <input
                  type="text"
                  value={listTitle}
                  onChange={e => setListTitle(e.target.value)}
                  placeholder="e.g. Award List"
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
                  <p className="text-[10px] text-indigo-200 font-medium leading-tight">Portrait Award Lists are side-by-side. Ensure your printer is set to Portrait.</p>
                </div>
              </div>
            </div>
          </div>

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

      <div className="print-area hidden">
        {(() => {
          const subjectList = selectedSubject === 'all' 
            ? allSubjects 
            : [{ id: 'custom', subject_name: listTitle, total_marks: grandTotalMaxMarks }];

          return subjectList.flatMap((subject) => {
            const subCols = selectedSubject === 'all'
              ? [{ id: subject.id, label: subject.subject_name, maxMarks: String(subject.total_marks || 100) }]
              : columns;

            const subGrandTotal = subCols.reduce((sum, col) => sum + (Number(col.maxMarks) || 0), 0);
            const pages = [];
            for (let i = 0; i < displayStudents.length; i += CHUNK_SIZE) {
              pages.push(displayStudents.slice(i, i + CHUNK_SIZE));
            }

            return pages.map((chunk, chunkIndex) => (
              <div key={`${subject.id}-${chunkIndex}`} className="page-break relative">
                <div className="flex gap-4 h-full">
                  {[1, 2].map(copyNum => (
                    <div key={copyNum} className="flex-1 flex flex-col px-2 overflow-hidden">
                      <div className="flex items-start justify-between border-b border-black pb-1 mb-2">
                        <div className="w-10 h-10 shrink-0">
                          {schoolInfo?.logo_url && <img src={schoolInfo.logo_url} alt="logo" className="w-full h-full object-contain" />}
                        </div>
                        <div className="flex-1 text-center px-1">
                          <h1 className="text-xs font-black uppercase text-black leading-tight tracking-tight">{schoolInfo?.name || 'School Name'}</h1>
                          <h2 className="text-[10px] font-black uppercase mt-0.5 text-black underline underline-offset-1">
                            {selectedSubject === 'all' ? `${subject.subject_name} Award List` : listTitle}
                          </h2>
                          <p className="text-[8px] font-black text-black opacity-80 mt-0.5">
                            {copyNum === 1 ? 'OFFICE COPY' : 'AWARD LIST'} — {currentExam?.name || ''}
                          </p>
                        </div>
                        <div className="text-[7px] font-bold text-black border border-black p-0.5 text-right min-w-[50px]">
                          <p className="truncate">CLASS: {currentClass ? `${currentClass.name} ${currentClass.section}` : 'N/A'}</p>
                          <p>MAX: {subGrandTotal}</p>
                        </div>
                      </div>

                      <table className="w-full border-collapse border border-black text-[8px]">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="border border-black p-0.5 text-center w-5">Sr.</th>
                            <th className="border border-black p-0.5 text-left">Student Name</th>
                            {subCols.map(col => (
                              <th key={col.id} className="border border-black p-0.5 text-center">
                                {selectedSubject === 'all' ? 'Marks' : col.label}
                              </th>
                            ))}
                            <th className="border border-black p-0.5 text-center w-8">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chunk.map((stu, i) => {
                            const srNo = chunkIndex * CHUNK_SIZE + i + 1;
                            const studentMarks = marksData[stu.id];
                            return (
                              <tr key={stu.id} className="h-5">
                                <td className="border border-black p-0.5 text-center">{srNo}</td>
                                <td className="border border-black p-0.5 font-bold uppercase truncate max-w-[80px] text-[8px]">
                                  {stu.full_name}
                                  {stu.roll_number && <span className="text-[6px] font-normal ml-1 opacity-50">(#{stu.roll_number})</span>}
                                </td>
                                {subCols.map(col => {
                                  const score = studentMarks?.[col.id];
                                  return (
                                    <td key={col.id} className="border border-black text-center font-bold">
                                      {score !== undefined ? score : ''}
                                    </td>
                                  );
                                })}
                                <td className="border border-black text-center font-bold">
                                  {(() => {
                                    if (!studentMarks) return '';
                                    const sum = subCols.reduce((acc, col) => acc + (studentMarks[col.id] || 0), 0);
                                    return sum > 0 ? sum : '';
                                  })()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      <div className="mt-auto pt-4 grid grid-cols-2 gap-2">
                        <div className="border-t border-black pt-0.5 text-[7px] font-bold uppercase text-center">Teacher Sig.</div>
                        <div className="border-t border-black pt-0.5 text-[7px] font-bold uppercase text-center">Principal</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="copy-divider"></div>
              </div>
            ));
          });
        })()}
      </div>
    </div>
  );
}
