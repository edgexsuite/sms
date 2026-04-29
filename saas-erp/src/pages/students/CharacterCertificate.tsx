import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Printer, Search, FileText } from 'lucide-react';
import { formatDate } from '../../lib/utils';

export default function CharacterCertificate() {
  const { userRole } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [remarks, setRemarks] = useState('Excellent');

  useEffect(() => {
    if (userRole?.school_id) {
      fetchStudents();
      fetchSchoolInfo();
    }
  }, [userRole]);

  const fetchSchoolInfo = async () => {
    const { data } = await supabase.from('schools').select('*').eq('id', userRole?.school_id).single();
    if (data) setSchoolInfo(data);
  };

  const fetchStudents = async () => {
    const { data } = await supabase.from('students').select(`*, classes (name, section), parents (father_name)`).eq('school_id', userRole?.school_id).order('roll_number');
    if (data) setStudents(data);
  };

  const handlePrint = () => window.print();
  const filteredStudents = students.filter(s => s.full_name.toLowerCase().includes(search.toLowerCase()) || s.roll_number.toString().includes(search));

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          .no-print { display: none !important; }
          body { background: white; margin: 0; padding: 0; }
          .certificate { width: 277mm !important; height: 190mm !important; margin: 0 auto; outline: none; }
        }
      `}</style>

      <div className="max-w-6xl mx-auto space-y-6 print:m-0 print:space-y-0">
        <h1 className="text-2xl font-bold text-gray-900 print:hidden">Character Certificate</h1>
        
        <div className="flex gap-6 print:block">
          <div className="w-1/3 bg-white rounded-lg shadow border border-gray-200 overflow-hidden flex flex-col h-[600px] print:hidden">
             <div className="p-4 border-b border-gray-200">
               <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                 <input type="text" placeholder="Search by Name/Roll..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded focus:ring-blue-500 text-sm" />
               </div>
             </div>
             <div className="overflow-y-auto flex-1 p-2">
               {filteredStudents.map(stu => (
                 <button key={stu.id} onClick={() => setSelectedStudent(stu)} className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${selectedStudent?.id === stu.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                   <p className="font-bold text-gray-900 text-sm">{stu.full_name}</p>
                 </button>
               ))}
             </div>
          </div>

          <div className="flex-1 bg-gray-100 rounded-lg flex flex-col p-6 items-center overflow-hidden h-[600px] overflow-y-auto border border-gray-300 shadow-inner print:block print:p-0 print:bg-white print:border-none print:shadow-none print:h-auto print:overflow-visible">
             {selectedStudent ? (
                <div className="w-full max-w-2xl flex justify-between items-center mb-4 print:hidden">
                  <div className="flex-1 max-w-xs">
                    <label className="text-xs font-bold text-gray-600 block mb-1">Set Character Remarks</label>
                    <select value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full p-2 border rounded text-sm">
                      <option value="Excellent">Excellent</option>
                      <option value="Good">Good</option>
                      <option value="Satisfactory">Satisfactory</option>
                    </select>
                  </div>
                  <button onClick={handlePrint} className="px-6 py-2 bg-blue-600 text-white rounded font-medium shadow-md hover:bg-blue-700 flex items-center gap-2">
                    <Printer className="w-4 h-4" /> Print
                  </button>
                </div>
             ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400"><FileText className="w-16 h-16 mb-4 opacity-50" /><p>Select a student.</p></div>
             )}

             {selectedStudent && (
               <div className="certificate bg-white w-full max-w-[277mm] min-h-[190mm] shadow-xl relative flex flex-col items-center justify-center border border-gray-200 mx-auto overflow-hidden p-10 print:p-8">
                  {/* Decorative Borders */}
                  <div className="absolute inset-2 print:inset-3 border-[8px] border-double border-green-900 pointer-events-none rounded-xl opacity-90"></div>
                  <div className="absolute inset-4 print:inset-5 border-[1px] border-solid border-green-900 opacity-30 pointer-events-none rounded-lg"></div>

                  <div className="flex w-full items-center justify-center gap-6 mb-4 z-10">
                     {schoolInfo?.logo_url && (
                       <img src={schoolInfo.logo_url} alt="School Logo" className="w-28 h-28 object-contain" />
                     )}
                     <div className="text-center">
                        <h1 className="text-4xl font-serif font-black text-green-900 uppercase tracking-wider">{schoolInfo?.name || 'School Name'}</h1>
                        <p className="text-base font-medium text-gray-600 mt-1">{schoolInfo?.address || 'School Address Line - City, Country'}</p>
                        <p className="text-sm font-medium text-gray-500">{schoolInfo?.contact_phone || 'Phone: +123456789'}</p>
                     </div>
                  </div>
                     
                  <div className="py-1 px-10 mx-auto border-t-2 border-b-2 border-green-900 text-green-900 mb-4 z-10 tracking-widest text-lg font-serif bg-green-50">
                    <h2 className="font-bold">CHARACTER CERTIFICATE</h2>
                  </div>

                  <div className="w-full text-center text-base font-serif italic mb-4 text-gray-600 z-10">To Whom It May Concern</div>

                  <div className="w-full max-w-4xl leading-[2.2] text-justify text-lg font-serif space-y-3 z-10 px-8">
                     <p>
                       This is to certify that student <span className="font-bold underline decoration-dotted capitalize px-3 text-xl">{selectedStudent.full_name}</span>,
                       son/daughter of <span className="font-bold underline decoration-dotted capitalize px-3 text-xl">{selectedStudent.parents?.father_name || '_____________'}</span>,
                       bearing Roll Number <span className="font-bold underline decoration-dotted px-3 text-xl">{selectedStudent.roll_number}</span>,
                       has been a bonafide student of our institution.
                     </p>
                     <p>
                       During his/her tenure at the school, he/she maintained a <span className="inline-block bg-green-50 border border-green-200 px-3 flex-none text-center font-bold text-xl tracking-wide font-sans text-green-800 rounded">{remarks}</span> moral character. 
                       He/She was diligent in academic duties and actively participated in extracurricular school activities.
                     </p>
                     <p>
                       He/She does not actively take part in any political or illegal subversive activities that might be detrimental to the institution or the state. We verify his/her identity to the best of our knowledge.
                     </p>
                  </div>

                  <div className="mt-auto flex w-full justify-between items-end px-12 pb-0 pt-8 font-serif text-base z-10">
                     <div className="text-center w-56 flex flex-col items-center">
                       <span className="mb-2 w-full border-b border-gray-400 border-dashed pb-1">{formatDate(new Date())}</span>
                       <span className="text-sm font-semibold text-gray-600">Date of Issue</span>
                     </div>
                     <div className="text-center w-56 flex flex-col items-center">
                       <div className="w-full border-t border-gray-800 mb-2 mt-12 bg-gray-200"></div>
                       <span className="text-sm font-semibold text-gray-800">Principal / Headmaster</span>
                     </div>
                  </div>
               </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
