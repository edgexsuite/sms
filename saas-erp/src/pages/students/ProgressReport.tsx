import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Search, FileText, Printer, AlertCircle } from 'lucide-react';
import { formatDate } from '../../lib/utils';

export default function ProgressReport() {
  const { userRole } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchStudents();
    }
  }, [userRole]);

  const fetchStudents = async () => {
    const { data } = await supabase.from('students').select(`*, classes (name, section)`).eq('school_id', userRole?.school_id).order('roll_number');
    if (data) setStudents(data);
  };

  const handlePrint = () => window.print();

  const filteredStudents = students.filter(s => s.full_name.toLowerCase().includes(search.toLowerCase()) || s.roll_number.toString().includes(search));

  return (
    <div className="space-y-6">
       <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; margin: 0; padding: 0; }
          .report-card { width: 210mm; min-height: 297mm; padding: 15mm; margin: 0 auto; outline: none; border: none; box-shadow: none; }
        }
      `}</style>

      <div className="max-w-6xl mx-auto space-y-6 print:m-0 print:space-y-0">
        <h1 className="text-2xl font-bold text-gray-900 print:hidden">Student Progress Reports</h1>
        <p className="text-gray-500 text-sm mt-1 border-l-4 border-blue-500 pl-3 bg-blue-50 py-2 print:hidden">
          Note: This is a foundational structural layout. Real academic grades will automatically sync here once the "Exams Module" is built.
        </p>

        <div className="flex gap-6 print:block">
          <div className="w-1/3 bg-white rounded-lg shadow border border-gray-200 overflow-hidden flex flex-col h-[600px] print:hidden">
             <div className="p-4 border-b border-gray-200">
               <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                 <input type="text" placeholder="Search student..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded focus:ring-blue-500 text-sm" />
               </div>
             </div>
             <div className="overflow-y-auto flex-1 p-2">
               {filteredStudents.map(stu => (
                 <button key={stu.id} onClick={() => setSelectedStudent(stu)} className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${selectedStudent?.id === stu.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                   <p className="font-bold text-gray-900 text-sm">{stu.full_name}</p>
                   <p className="text-xs text-gray-500">Class: {stu.classes?.name}</p>
                 </button>
               ))}
             </div>
          </div>

          <div className="flex-1 bg-gray-100 rounded-lg flex flex-col p-6 items-center overflow-hidden h-[600px] overflow-y-auto border border-gray-300 shadow-inner print:block print:p-0 print:bg-white print:border-none print:shadow-none print:h-auto print:overflow-visible">
             {selectedStudent ? (
                <div className="w-full max-w-2xl text-right mb-4 print:hidden">
                  <button onClick={handlePrint} className="px-6 py-2 bg-blue-600 text-white rounded font-medium shadow-md hover:bg-blue-700 flex items-center gap-2 ml-auto">
                    <Printer className="w-4 h-4" /> Print Report Card
                  </button>
                </div>
             ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400"><FileText className="w-16 h-16 mb-4 opacity-50" /><p>Select a student to view academic records.</p></div>
             )}

             {selectedStudent && (
               <div className="report-card bg-white w-full max-w-[210mm] shadow-xl p-8 border border-gray-300">
                  <div className="text-center border-b-4 border-blue-900 pb-4 mb-6">
                    <h2 className="text-3xl font-black uppercase tracking-widest text-blue-900">Academic Progress Report</h2>
                    <p className="mt-1 font-bold text-gray-600">Session 2025-2026</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-8 text-sm border-2 border-gray-800 p-4 rounded bg-gray-50">
                    <div><span className="font-bold text-gray-600 block">Student Name:</span><span className="text-lg font-bold">{selectedStudent.full_name}</span></div>
                    <div><span className="font-bold text-gray-600 block">Roll Number:</span><span className="text-lg font-bold">{selectedStudent.roll_number}</span></div>
                    <div><span className="font-bold text-gray-600 block">Class & Section:</span><span className="text-lg font-bold">{selectedStudent.classes?.name} - {selectedStudent.classes?.section}</span></div>
                    <div><span className="font-bold text-gray-600 block">Date of Birth:</span><span className="text-lg font-bold">{formatDate(selectedStudent.dob)}</span></div>
                  </div>

                  {/* Mock Academic Grades Table */}
                  <div className="mb-8 relative">
                     <table className="w-full border-collapse border border-gray-800 text-center">
                       <thead className="bg-gray-100">
                         <tr>
                           <th className="border border-gray-800 p-2 font-bold text-left">Subjects</th>
                           <th className="border border-gray-800 p-2 font-bold">Mid Term</th>
                           <th className="border border-gray-800 p-2 font-bold">Final Term</th>
                           <th className="border border-gray-800 p-2 font-bold bg-gray-200">Total</th>
                           <th className="border border-gray-800 p-2 font-bold">Grade</th>
                         </tr>
                       </thead>
                       <tbody>
                         {['Mathematics', 'Science', 'English', 'History', 'Computer Science'].map((sub, i) => (
                           <tr key={i}>
                             <td className="border border-gray-800 p-2 text-left font-medium">{sub}</td>
                             <td className="border border-gray-800 p-2 text-gray-400 italic">Pending Data</td>
                             <td className="border border-gray-800 p-2 text-gray-400 italic">Pending Data</td>
                             <td className="border border-gray-800 p-2 bg-gray-50">__ / 100</td>
                             <td className="border border-gray-800 p-2 font-bold text-gray-300">-</td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                     
                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-white/90 px-6 py-3 border-2 border-dashed border-red-400 text-red-600 font-bold rotate-[-15deg] text-xl tracking-wider uppercase backdrop-blur-sm rounded shadow-lg">
                           Awaiting Examination Module Data
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-12 mt-20">
                     <div className="border-t-2 border-black pt-2 text-center font-bold">Class Teacher Signature</div>
                     <div className="border-t-2 border-black pt-2 text-center font-bold">Principal Signature</div>
                  </div>

               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
