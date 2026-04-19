import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Printer, Users, CheckSquare, Square, CreditCard } from 'lucide-react';
import { cn } from '../../lib/utils';
import { CardTemplate, TemplateId } from '../../lib/idCardTemplates';

export default function DigitalIDCards() {
  const { userRole } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [activeFields, setActiveFields] = useState<string[]>([]);
  const [template, setTemplate] = useState<TemplateId>('classic');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchClasses();
      fetchSchoolInfo();
      fetchSettings();
    }
  }, [userRole]);

  useEffect(() => {
    if (selectedClass) fetchStudents();
    else setStudents([]);
  }, [selectedClass]);

  const fetchSchoolInfo = async () => {
    const { data } = await supabase.from('schools').select('name, logo_url, address, contact_phone').eq('id', userRole?.school_id).single();
    if (data) setSchoolInfo(data);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name, section').eq('school_id', userRole?.school_id).order('name');
    if (data) setClasses(data);
  };

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('id_card_settings')
      .select('fields, template')
      .eq('school_id', userRole?.school_id)
      .eq('card_type', 'student')
      .maybeSingle();

    if (data?.fields) {
      setActiveFields(data.fields);
    } else {
      // Defaults
      setActiveFields(['roll_number', 'class_id', 'blood_group', 'emergency_contact']);
    }
    setTemplate((data?.template as TemplateId) ?? 'classic');
  };

  const fetchStudents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('students')
      .select(`
        id, full_name, roll_number, photograph_url, blood_group, dob, gender, admission_date, address,
        parents(whatsapp_number)
      `)
      .eq('class_id', selectedClass)
      .eq('status', 'active')
      .order('roll_number');
    
    if (data) {
      setStudents(data);
      setSelectedStudents(new Set(data.map(s => s.id)));
    }
    setLoading(false);
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
  const isHorizontal = ['horizon', 'mint'].includes(template);

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; margin: 0; padding: 0; }
          .id-grid { display: flex; flex-wrap: wrap; gap: 8mm; justify-content: center; }
          .id-card {
            width: ${isHorizontal ? '86mm' : '54mm'};
            height: ${isHorizontal ? '54mm' : '86mm'};
            page-break-inside: avoid;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
        @media screen {
          .id-card {
            width: ${isHorizontal ? '86mm' : '54mm'};
            height: ${isHorizontal ? '54mm' : '86mm'};
          }
        }
      `}</style>
      
      <div className="max-w-6xl mx-auto space-y-6 print:hidden">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-[#0d1526] flex items-center gap-2 uppercase tracking-tight">
              <CreditCard className="w-7 h-7 text-blue-600" /> Digital ID Cards
            </h1>
            <p className="text-slate-500 text-sm mt-1 font-medium">Generate standard CR80 (54mm x 86mm) printable ID cards.</p>
          </div>
          <button onClick={handlePrint} disabled={selectedStudents.size === 0} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg active:scale-95 disabled:opacity-50">
            <Printer className="w-4 h-4" /> Print {selectedStudents.size} Cards
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl flex flex-col md:flex-row gap-6">
          <div className="md:w-1/3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Select Target Class</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all">
              <option value="">-- Choose Class --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.section})</option>)}
            </select>
          </div>
          
          {selectedClass && (
             <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 flex justify-between items-center bg-white">
                  <div className="flex items-center gap-3">
                    <button onClick={toggleAll} className="p-2 rounded-lg text-slate-400 hover:text-blue-600 transition-colors">
                      {selectedStudents.size === students.length && students.length > 0 ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5" />}
                    </button>
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Enrollment Selection</span>
                  </div>
                  <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase tracking-widest">{selectedStudents.size} selected</span>
                </div>
                <div className="max-h-48 overflow-y-auto px-4 py-2 custom-scrollbar">
                  {students.map(stu => (
                    <div key={stu.id} className="flex items-center gap-3 py-2 px-3 border-b border-white/50 last:border-0 cursor-pointer group" onClick={() => toggleStudent(stu.id)}>
                      {selectedStudents.has(stu.id) ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />}
                      <span className={cn("text-xs font-bold uppercase", selectedStudents.has(stu.id) ? "text-slate-900" : "text-slate-500")}>{stu.roll_number} - {stu.full_name}</span>
                    </div>
                  ))}
                </div>
             </div>
          )}
        </div>
      </div>

      {/* Printable Area Layout */}
      <div className={`mt-8 ${selectedStudents.size > 0 ? '' : 'hidden'}`}>
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8 text-center print:hidden">Live Sheet Preview</h3>
        
        <div className="id-grid flex flex-wrap gap-8 justify-center bg-slate-100 p-12 rounded-[40px] print:p-0 print:bg-white print:gap-[10mm]">
          {students.filter(s => selectedStudents.has(s.id)).map(student => (
            <div key={student.id} className="id-card shadow-lg">
              <CardTemplate
                template={template}
                mode="student"
                name={student.full_name}
                photo={student.photograph_url}
                className={currentClass ? `${currentClass.name} ${currentClass.section}` : ''}
                rollNumber={student.roll_number}
                schoolName={schoolInfo?.name || ''}
                schoolLogo={schoolInfo?.logo_url || null}
                qrValue={JSON.stringify({ type: 'student_attendance', student_id: student.id, roll: student.roll_number })}
                activeFields={activeFields}
                bloodGroup={student.blood_group}
                dob={student.dob}
                phone={student.parents?.whatsapp_number}
                address={student.address}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
