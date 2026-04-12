import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Printer, Users, CheckSquare, Square, Download } from 'lucide-react';
import QRCode from 'react-qr-code';

export default function DigitalIDCards() {
  const { userRole } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchClasses();
      fetchSchoolInfo();
    }
  }, [userRole]);

  useEffect(() => {
    if (selectedClass) fetchStudents();
    else setStudents([]);
  }, [selectedClass]);

  const fetchSchoolInfo = async () => {
    const { data } = await supabase.from('schools').select('*').eq('id', userRole?.school_id).single();
    if (data) setSchoolInfo(data);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name, section').eq('school_id', userRole?.school_id).order('name');
    if (data) setClasses(data);
  };

  const fetchStudents = async () => {
    const { data } = await supabase.from('students').select('id, full_name, roll_number, photograph_url, blood_group, emergency_contact:parents(whatsapp_number)').eq('class_id', selectedClass).eq('status', 'active').order('roll_number');
    if (data) {
      setStudents(data);
      setSelectedStudents(new Set(data.map(s => s.id)));
    }
  };

  const toggleStudent = (id: string) => {
    const newSet = new Set(selectedStudents);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedStudents(newSet);
  };

  const toggleAll = () => {
    if (selectedStudents.size === students.length) setSelectedStudents(new Set());
    else setSelectedStudents(new Set(students.map(s => s.id)));
  };

  const handlePrint = () => {
    window.print();
  };

  const currentClass = classes.find(c => c.id === selectedClass);

  return (
    <div className="space-y-6">
      {/* Hide controls during printing */}
      <style>{`
        @media print {
          .print-only { display: block !important; }
          body { background: white; margin: 0; padding: 0; }
          .id-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10mm; justify-content: center; }
          .id-card { 
             width: 54mm; height: 86mm; 
             page-break-inside: avoid; 
             -webkit-print-color-adjust: exact !important; 
             print-color-adjust: exact !important; 
             border: 1px solid #ddd;
          }
        }
        @media screen {
          .print-only { display: none; }
          .id-card { width: 54mm; height: 86mm; }
        }
      `}</style>
      
      <div className="max-w-6xl mx-auto space-y-6 print:hidden">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Digital ID Cards</h1>
            <p className="text-gray-500 text-sm mt-1">Generate standard CR80 (54mm x 86mm) printable ID cards.</p>
          </div>
          <button onClick={handlePrint} disabled={selectedStudents.size === 0} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50">
            <Printer className="w-4 h-4" /> Print {selectedStudents.size} Cards
          </button>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 flex flex-col md:flex-row gap-6">
          <div className="md:w-1/3">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Class</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500">
              <option value="">-- Choose Class --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.section})</option>)}
            </select>
          </div>
          
          {selectedClass && (
             <div className="flex-1 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-white">
                  <div className="flex items-center gap-3">
                    <button onClick={toggleAll} className="text-gray-500 hover:text-blue-600">
                      {selectedStudents.size === students.length ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </button>
                    <span className="text-sm font-medium text-gray-700">Select Students</span>
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">{selectedStudents.size} selected</span>
                </div>
                <div className="max-h-48 overflow-y-auto px-4 py-2">
                  {students.map(stu => (
                    <div key={stu.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0 cursor-pointer" onClick={() => toggleStudent(stu.id)}>
                      {selectedStudents.has(stu.id) ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-gray-400" />}
                      <span className="text-sm font-medium text-gray-800">{stu.roll_number} - {stu.full_name}</span>
                    </div>
                  ))}
                </div>
             </div>
          )}
        </div>
      </div>

      {/* Printable Area Layout */}
      <div className={`mt-8 ${selectedStudents.size > 0 ? '' : 'hidden'}`}>
        <h3 className="text-lg font-bold text-gray-900 mb-6 text-center print:hidden">Live Preview (A4 Setup)</h3>
        
        <div className="id-grid flex flex-wrap gap-8 justify-center bg-gray-100 p-8 rounded-lg print:p-0 print:bg-white print:gap-[10mm]">
          {students.filter(s => selectedStudents.has(s.id)).map(student => (
            <div key={student.id} className="id-card bg-white rounded-xl shadow-lg relative overflow-hidden flex flex-col font-sans">
              {/* Header Curve */}
              <div className="bg-blue-600 h-24 w-full absolute top-0 flex flex-col items-center justify-start pt-3" style={{ borderBottomLeftRadius: '50%', borderBottomRightRadius: '50%', transform: 'scaleX(1.2)' }}>
              </div>
              
              {/* School Info */}
              <div className="relative z-10 w-full text-center pt-2 px-2 pb-1">
                <h2 className="text-white font-bold text-[10px] leading-tight max-w-[45mm] mx-auto uppercase">{schoolInfo?.name || 'School Name Here'}</h2>
                <p className="text-blue-100 text-[6px] tracking-widest uppercase mt-0.5 font-medium">STUDENT IDENTITY CARD</p>
              </div>

              {/* Photo Area */}
              <div className="relative z-10 mx-auto mt-1 w-16 h-16 rounded-full border-[3px] border-white shadow-sm bg-gray-200 overflow-hidden flex items-center justify-center">
                {student.photograph_url ? (
                  <img src={student.photograph_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-8 h-8 text-gray-400" />
                )}
              </div>

              {/* Student Details */}
              <div className="flex-1 flex flex-col items-center text-center px-4 mt-2">
                <h3 className="font-bold text-[13px] text-gray-900 tracking-tight leading-tight">{student.full_name || 'STUDENT NAME'}</h3>
                <span className="text-[9px] font-bold text-blue-600 uppercase mt-0.5 tracking-wider bg-blue-50 px-2 py-0.5 rounded">CLASS: {currentClass ? `${currentClass.name} ${currentClass.section}` : '-'}</span>

                <div className="w-full mt-3 flex flex-col gap-1 text-[8px] text-left border-t border-gray-100 pt-2 px-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Roll No:</span>
                    <span className="font-bold text-gray-800">{student.roll_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Blood Grp:</span>
                    <span className="font-bold text-gray-800 text-red-600">{student.blood_group || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Emergency:</span>
                    <span className="font-bold text-gray-800">{student.emergency_contact?.whatsapp_number || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* QR Code / Footer */}
              <div className="h-12 bg-white flex items-center justify-center relative border-t border-gray-100">
                <div className="bg-white p-1 rounded">
                   <QRCode 
                     value={JSON.stringify({ type: 'student_attendance', student_id: student.id, roll: student.roll_number })} 
                     size={38} 
                     level="M" 
                   />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
