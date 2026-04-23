import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Printer, Users, CheckSquare, Square, Shield, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { CardTemplate, TemplateId, CardCustomization } from '../../lib/idCardTemplates';

export default function StaffDigitalIDCards() {
  const { userRole } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeFields, setActiveFields] = useState<string[]>([]);
  const [template, setTemplate] = useState<TemplateId>('classic');
  const [customization, setCustomization] = useState<CardCustomization | undefined>(undefined);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchSchoolInfo();
      fetchStaff();
      fetchSettings();
    }
  }, [userRole]);

  const fetchSchoolInfo = async () => {
    const { data } = await supabase.from('schools').select('name, logo_url, address, contact_phone').eq('id', userRole?.school_id).single();
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
      .select('fields, template, layout_config')
      .eq('school_id', userRole?.school_id)
      .eq('card_type', 'staff')
      .maybeSingle();

    if (data?.fields) {
      setActiveFields(data.fields);
    } else {
      // Defaults
      setActiveFields(['designation', 'department', 'joining_date', 'ref_id']);
    }
    setTemplate((data?.template as TemplateId) ?? 'classic');
    if (data?.layout_config?.customization) setCustomization(data.layout_config.customization);
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

  const isHorizontal = ['horizon', 'mint'].includes(template);

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; padding: 0; }
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
            <div key={st.id} className="id-card shadow-lg">
              <CardTemplate
                template={template}
                mode="staff"
                name={st.full_name}
                photo={st.photograph_url}
                role={st.role || ''}
                designation={st.designation || null}
                department={st.department || null}
                joiningDate={st.joining_date || null}
                refId={st.id.substring(0, 8).toUpperCase()}
                phone={st.whatsapp_number}
                schoolName={schoolInfo?.name || ''}
                schoolLogo={schoolInfo?.logo_url || null}
                qrValue={JSON.stringify({ type: 'staff_attendance', staff_id: st.id })}
                activeFields={activeFields}
                customization={customization}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
