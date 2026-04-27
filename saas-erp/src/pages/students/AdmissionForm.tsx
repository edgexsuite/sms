import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Printer, FileText } from 'lucide-react';

export default function AdmissionForm() {
  const { userRole } = useAuth();
  const [formSettings, setFormSettings] = useState<any>(null);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchData();
    }
  }, [userRole]);

  const fetchData = async () => {
    const { data: sData } = await supabase.from('schools').select('*').eq('id', userRole?.school_id).single();
    if (sData) setSchoolInfo(sData);

    const { data: fsData } = await supabase.from('form_settings').select('sections_config').eq('school_id', userRole?.school_id).eq('form_name', 'student_admission').single();
    if (fsData) setFormSettings(fsData.sections_config);

    const { data: cwData } = await supabase.from('custom_fields').select('*').eq('school_id', userRole?.school_id).eq('form_name', 'student_admission');
    if (cwData) setCustomFields(cwData);
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; margin: 0; padding: 0; }
          .admission-form { width: 210mm; min-height: 297mm; padding: 15mm; margin: 0 auto; outline: none; }
          .field-box { border-bottom: 1px dotted #000; height: 28px; }
        }
      `}</style>

      <div className="max-w-6xl mx-auto space-y-6 print:m-0 print:space-y-0">
        <div className="flex justify-between items-center print:hidden">
          <h1 className="text-2xl font-bold text-gray-900">Blank Admission Form</h1>
          <button onClick={handlePrint} className="px-6 py-2 bg-blue-600 text-white rounded font-medium shadow-md hover:bg-blue-700 flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print Form
          </button>
        </div>
        <p className="text-gray-500 print:hidden">This automatically generates a highly structured PDF paper form matching the EXACT fields enabled in your Custom Form Builder.</p>
      </div>

      <div className="bg-gray-100 py-10 print:py-0 print:bg-white text-black">
        <div className="admission-form bg-white w-[210mm] min-h-[297mm] shadow-xl border border-gray-300 mx-auto font-sans p-10 box-border text-[13px] leading-tight text-black">
          
          <div className="flex justify-between items-start mb-6 border-b-2 border-black pb-4">
             <div>
               <h1 className="text-3xl font-black uppercase tracking-tight">{schoolInfo?.name || 'SCHOOL NAME'}</h1>
               <p className="mt-1 font-medium">{schoolInfo?.address}</p>
               <h2 className="text-xl font-bold uppercase mt-4 underline decoration-double">Application for Admission</h2>
             </div>
             <div className="w-32 h-40 border-2 border-dashed border-gray-400 flex items-center justify-center text-center text-gray-400 p-2">
               Affix Passport Size Photograph Here
             </div>
          </div>

          {/* BASIC INFO */}
          <div className="mb-6">
             <h3 className="font-bold text-[15px] bg-gray-200 p-1 mb-3 uppercase border border-black">1. Student Details</h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
               <div><span className="font-semibold block mb-0.5">Full Name of Student:</span><div className="field-box"></div></div>
               <div><span className="font-semibold block mb-0.5">Date of Birth:</span><div className="field-box"></div></div>
               <div><span className="font-semibold block mb-0.5">B-Form / CNIC:</span><div className="field-box"></div></div>
               <div><span className="font-semibold block mb-0.5">Gender (Male/Female):</span><div className="field-box"></div></div>
               <div><span className="font-semibold block mb-0.5">Religion:</span><div className="field-box"></div></div>
               <div><span className="font-semibold block mb-0.5">Hobbies:</span><div className="field-box"></div></div>
               
               {customFields.filter(f => f.section_name === 'basic_info').map(f => (
                 <div key={f.id}><span className="font-semibold block mb-0.5">{f.field_label}:</span><div className="field-box"></div></div>
               ))}
             </div>
          </div>

          {/* PARENT INFO */}
          <div className="mb-6">
             <h3 className="font-bold text-[15px] bg-gray-200 p-1 mb-3 uppercase border border-black">2. Family Information</h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
               <div className="col-span-2"><span className="font-semibold block mb-0.5">Home Address:</span><div className="field-box"></div></div>
               <div><span className="font-semibold block mb-0.5">Father's Name:</span><div className="field-box"></div></div>
               <div><span className="font-semibold block mb-0.5">Mother's Name:</span><div className="field-box"></div></div>
               <div><span className="font-semibold block mb-0.5">Father's Mobile No:</span><div className="field-box"></div></div>
               <div><span className="font-semibold block mb-0.5">Mother's Mobile No:</span><div className="field-box"></div></div>
               
               {(!formSettings || formSettings.parent_info) && (
                 <>
                   <div><span className="font-semibold block mb-0.5">Father's Occupation:</span><div className="field-box"></div></div>
                   <div><span className="font-semibold block mb-0.5">Mother's Occupation:</span><div className="field-box"></div></div>
                   <div><span className="font-semibold block mb-0.5">Father's Qualification:</span><div className="field-box"></div></div>
                   <div><span className="font-semibold block mb-0.5">Mother's Qualification:</span><div className="field-box"></div></div>
                 </>
               )}

               {customFields.filter(f => f.section_name === 'parent_info').map(f => (
                 <div key={f.id}><span className="font-semibold block mb-0.5">{f.field_label}:</span><div className="field-box"></div></div>
               ))}
             </div>
          </div>

          {/* PREVIOUS SCHOOL */}
          {(!formSettings || formSettings.admission_info) && (
             <div className="mb-6">
               <h3 className="font-bold text-[15px] bg-gray-200 p-1 mb-3 uppercase border border-black">3. Academic History</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                 <div><span className="font-semibold block mb-0.5">Name of Last School:</span><div className="field-box"></div></div>
                 <div><span className="font-semibold block mb-0.5">Class Applying For:</span><div className="field-box"></div></div>
                 <div className="col-span-2"><span className="font-semibold block mb-0.5">Reason for choosing our school:</span><div className="field-box"></div></div>
               </div>
             </div>
          )}

          {/* DECLARATION */}
          <div className="mb-6 mt-10">
             <h3 className="font-bold text-[15px] bg-black text-white p-1 mb-3 uppercase">Declaration by Parent / Guardian</h3>
             <p className="text-justify mb-8 leading-relaxed">
               I hereby declare that the information given above is true and correct to the best of my knowledge and belief. 
               I have read the rules and regulations of the school and agree to abide by them. I will be fully responsible for my ward.
             </p>
             <div className="flex justify-between items-end px-10">
                <div className="w-48 text-center border-t border-black pt-1 font-semibold">Date of Application</div>
                <div className="w-48 text-center border-t border-black pt-1 font-semibold">Signature of Parent</div>
             </div>
          </div>

          <div className="border-t-2 border-dashed border-gray-400 mt-12 mb-4"></div>
          <div className="text-center font-bold mb-4 uppercase">For Office Use Only</div>
          <div className="grid grid-cols-3 gap-8">
             <div><span className="block mb-1 text-sm">Admission No:</span><div className="border-b border-black h-6"></div></div>
             <div><span className="block mb-1 text-sm">Class Allotted:</span><div className="border-b border-black h-6"></div></div>
             <div><span className="block mb-1 text-sm">Principal Signature:</span><div className="border-b border-black h-6"></div></div>
          </div>

        </div>
      </div>
    </div>
  );
}
