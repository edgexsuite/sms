import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Printer, Users, CheckSquare, Square, Shield, ChevronRight } from 'lucide-react';
import QRCode from 'react-qr-code';
import { cn } from '../../lib/utils';

export default function StaffDigitalIDCards() {
  const { userRole } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeFields, setActiveFields] = useState<string[]>([]);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchSchoolInfo();
      fetchStaff();
      fetchSettings();
    }
  }, [userRole]);

  const fetchSchoolInfo = async () => {
    const { data } = await supabase.from('schools').select('*').eq('id', userRole?.school_id).single();
    if (data) setSchoolInfo(data);
  };

  const fetchStaff = async () => {
    setLoading(true);
    const { data } = await supabase.from('staff').select('*').eq('school_id', userRole?.school_id).eq('is_active', true).order('role');
    if (data) {
      setStaff(data);
      setSelectedStaff(new Set(data.map(s => s.id)));
    }
    setLoading(false);
  };

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('id_card_settings')
      .select('fields')
      .eq('school_id', userRole?.school_id)
      .eq('card_type', 'staff')
      .maybeSingle();
    
    if (data?.fields) {
      setActiveFields(data.fields);
    } else {
      // Defaults
      setActiveFields(['designation', 'department', 'joining_date', 'ref_id']);
    }
  };

  const toggleStaff = (id: string) => {
    const newSet = new Set(selectedStaff);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedStaff(newSet);
  };

  const toggleAll = () => {
    if (selectedStaff.size === staff.length) setSelectedStaff(new Set());
    else setSelectedStaff(new Set(staff.map(s => s.id)));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; padding: 0; }
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
          .id-card { width: 54mm; height: 86mm; }
        }
      `}</style>
      
      <div className="max-w-6xl mx-auto space-y-6 print:hidden">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-[#0d1526] flex items-center gap-2 tracking-tight uppercase">
              <Shield className="w-7 h-7 text-indigo-600" /> Staff ID Cards
            </h1>
            <p className="text-slate-500 text-sm mt-1 font-medium">Generate professional faculty identification cards.</p>
          </div>
          <button onClick={handlePrint} disabled={selectedStaff.size === 0 || loading} className="flex items-center gap-2 px-6 py-2.5 bg-[#0d1526] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg active:scale-95">
            <Printer className="w-4 h-4" /> Print {selectedStaff.size} Cards
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-6">
           <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <button onClick={toggleAll} className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors">
                  {selectedStaff.size === staff.length && staff.length > 0 ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5" />}
                </button>
                <span className="text-sm font-black text-slate-700 uppercase tracking-tight">Select Faculty Members</span>
              </div>
              <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-widest">{selectedStaff.size} Selected</span>
           </div>

           <div className="max-h-64 overflow-y-auto pr-2 custom-scrollbar grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {loading ? (
                <div className="col-span-full py-20 flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading staff database...</p>
                </div>
              ) : staff.map(s => (
                <div 
                  key={s.id} 
                  className={cn(
                    "flex items-center gap-3 py-3 px-4 border rounded-2xl transition-all cursor-pointer group",
                    selectedStaff.has(s.id) ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-100 hover:border-slate-200"
                  )} 
                  onClick={() => toggleStaff(s.id)}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-md flex items-center justify-center transition-all",
                    selectedStaff.has(s.id) ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-300 group-hover:bg-slate-200"
                  )}>
                    {selectedStaff.has(s.id) && <CheckSquare className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className={cn("text-xs font-black uppercase tracking-tight", selectedStaff.has(s.id) ? "text-indigo-900" : "text-slate-700 font-bold")}>{s.full_name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{s.role}</p>
                  </div>
                </div>
              ))}
           </div>
        </div>
      </div>

      <div className={`mt-8 ${selectedStaff.size > 0 ? '' : 'hidden'}`}>
        <h3 className="text-[10px] font-black text-[#0d1526] uppercase tracking-[0.3em] mb-8 text-center print:hidden">A4 Layout Preview</h3>
        
        <div className="id-grid flex flex-wrap gap-8 justify-center bg-slate-100 p-12 rounded-[40px] print:p-0 print:bg-white print:gap-[10mm]">
          {staff.filter(s => selectedStaff.has(s.id)).map(st => (
            <div key={st.id} className="id-card bg-white rounded-xl shadow-lg relative overflow-hidden flex flex-col font-sans border border-slate-200">
              
              {/* Header Curve: Slate - Matching Student Style */}
              <div className="bg-[#1e293b] h-24 w-full absolute top-0 flex flex-col items-center justify-start pt-3" style={{ borderBottomLeftRadius: '50%', borderBottomRightRadius: '50%', transform: 'scaleX(1.2)' }}>
              </div>
              {/* School Info Overlay */}
              <div className="relative z-10 w-full text-center pt-2 px-2 pb-1">
                <h2 className="text-white font-black text-[9px] leading-tight max-w-[45mm] mx-auto uppercase tracking-tighter">{schoolInfo?.name || 'School Name Here'}</h2>
                <p className="text-slate-400 text-[6px] tracking-widest uppercase mt-0.5 font-black">FACULTY IDENTITY CARD</p>
              </div>

              {/* Centered Photo Area */}
              <div className="relative z-10 mx-auto mt-1 w-16 h-16 rounded-full border-[3px] border-white shadow-lg bg-slate-50 overflow-hidden flex items-center justify-center">
                {st.photograph_url ? (
                  <img src={st.photograph_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-8 h-8 text-slate-200" />
                )}
              </div>

              {/* Staff Details Header */}
              <div className="flex flex-col items-center text-center px-4 mt-2">
                <h3 className="font-black text-[13px] text-slate-900 tracking-tight leading-tight uppercase">{st.full_name || 'STAFF NAME'}</h3>
                <span className="text-[9px] font-black text-slate-500 uppercase mt-0.5 tracking-wider bg-slate-50 px-2 py-0.5 rounded border border-slate-100 italic">
                  {st.role?.includes('Teacher') ? 'Faculty Educator' : 'Administrative Staff'}
                </span>
                
                <div className="w-full mt-3 flex flex-col gap-1.5 text-[9px] text-center border-t border-slate-100 pt-3 px-1">
                   {activeFields.includes('designation') && (
                     <div className="font-extrabold text-slate-800 uppercase tracking-tight">{st.designation || st.role || 'Member'}</div>
                   )}
                   {activeFields.includes('department') && (
                     <div className="font-bold text-slate-500 uppercase tracking-widest">{st.department || 'General'}</div>
                   )}
                   {activeFields.includes('joining_date') && (
                     <div className="font-bold text-slate-400 italic">Since {st.joining_date || '2024'}</div>
                   )}
                   {activeFields.includes('whatsapp_number') && (
                     <div className="font-bold text-slate-500">{st.whatsapp_number || 'N/A'}</div>
                   )}
                   {activeFields.includes('ref_id') && (
                     <div className="font-black text-slate-300 font-mono tracking-widest text-[7px]">{st.id.substring(0, 8).toUpperCase()}</div>
                   )}
                </div>
              </div>

              {/* QR Code / Footer: Enlarged and Centered */}
              <div className="flex-1 flex flex-col items-center justify-center p-3">
                 <div className="bg-white p-2 rounded-xl border-2 border-slate-50 shadow-sm">
                    <QRCode 
                      value={JSON.stringify({ type: 'staff_attendance', staff_id: st.id })} 
                      size={56} 
                      level="M" 
                    />
                 </div>
                 {/* Aura Brand Accent Line: Slate */}
                 <div className="mt-3 w-8 h-1 bg-slate-900 rounded-full opacity-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
