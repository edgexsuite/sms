import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Printer, Users, CheckSquare, Square, Shield } from 'lucide-react';
import QRCode from 'react-qr-code';

export default function StaffDigitalIDCards() {
  const { userRole } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userRole?.school_id) {
      fetchSchoolInfo();
      fetchStaff();
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
          .print-only { display: block !important; }
          body:not(.printing-letter) .no-print { display: none !important; }
          body { background: white !important; margin: 0; padding: 0; }
          .id-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10mm; justify-content: center; }
          .id-card { 
             width: 54mm; height: 86mm; 
             page-break-inside: avoid; 
             -webkit-print-color-adjust: exact !important; 
             print-color-adjust: exact !important; 
             border: 1px solid #ddd;
          }
          
          /* Ensures UI hides properly */
          .standard-ui { display: none !important; }
        }
        @media screen {
          .print-only { display: none; }
          .id-card { width: 54mm; height: 86mm; }
        }
      `}</style>
      
      <div className="max-w-6xl mx-auto space-y-6 print:hidden standard-ui">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Shield className="w-6 h-6 text-indigo-600" /> Staff Digital ID Cards</h1>
            <p className="text-gray-500 text-sm mt-1">Generate standard CR80 (54mm x 86mm) printable ID cards for active staff.</p>
          </div>
          <button onClick={handlePrint} disabled={selectedStaff.size === 0 || loading} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 disabled:opacity-50">
            <Printer className="w-4 h-4" /> Print {selectedStaff.size} Cards
          </button>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 flex flex-col md:flex-row gap-6">
           <div className="w-full flex-1 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-white">
                <div className="flex items-center gap-3">
                  <button onClick={toggleAll} className="text-gray-500 hover:text-indigo-600">
                    {selectedStaff.size === staff.length && staff.length > 0 ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                  </button>
                  <span className="text-sm font-medium text-gray-700">Select Staff Members</span>
                </div>
                <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full font-medium">{selectedStaff.size} selected</span>
              </div>
              <div className="max-h-64 overflow-y-auto px-4 py-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {loading ? <div className="p-4 text-sm text-gray-500">Loading staff...</div> : staff.map(s => (
                  <div key={s.id} className="flex items-center gap-3 py-2 px-3 border border-gray-100 rounded-lg bg-white cursor-pointer hover:border-indigo-200" onClick={() => toggleStaff(s.id)}>
                    {selectedStaff.has(s.id) ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4 text-gray-400" />}
                    <div>
                      <span className="text-sm font-bold text-gray-800 block leading-tight">{s.full_name}</span>
                      <span className="text-xs text-gray-500">{s.role}</span>
                    </div>
                  </div>
                ))}
              </div>
           </div>
        </div>
      </div>

      {/* Printable Area Layout */}
      <div className={`mt-8 ${selectedStaff.size > 0 ? '' : 'hidden'}`}>
        <h3 className="text-lg font-bold text-gray-900 mb-6 text-center print:hidden">Live Preview (A4 Setup)</h3>
        
        <div className="id-grid flex flex-wrap gap-8 justify-center bg-gray-100 p-8 rounded-lg print:p-0 print:bg-white print:gap-[10mm]">
          {staff.filter(s => selectedStaff.has(s.id)).map(st => (
            <div key={st.id} className="id-card bg-white rounded-xl shadow-lg relative overflow-hidden flex flex-col font-sans">
              {/* Header Curve */}
              <div className="bg-indigo-800 h-24 w-full absolute top-0 flex flex-col items-center justify-start pt-3" style={{ borderBottomLeftRadius: '50%', borderBottomRightRadius: '50%', transform: 'scaleX(1.2)' }}>
              </div>
              
              {/* School Info */}
              <div className="relative z-10 w-full text-center pt-2 px-2 pb-1">
                <h2 className="text-white font-bold text-[10px] leading-tight max-w-[45mm] mx-auto uppercase">{schoolInfo?.name || 'School Name Here'}</h2>
                <p className="text-indigo-100 text-[6px] tracking-widest uppercase mt-0.5 font-medium">STAFF IDENTITY CARD</p>
              </div>

              {/* Photo Area */}
              <div className="relative z-10 mx-auto mt-1 w-16 h-16 rounded-full border-[3px] border-white shadow-sm bg-gray-200 overflow-hidden flex items-center justify-center">
                {st.photograph_url ? (
                  <img src={st.photograph_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-8 h-8 text-gray-400" />
                )}
              </div>

              {/* Staff Details */}
              <div className="flex-1 flex flex-col items-center text-center px-4 mt-2">
                <h3 className="font-bold text-[13px] text-gray-900 tracking-tight leading-tight uppercase">{st.full_name || 'STAFF NAME'}</h3>
                <span className="text-[9px] font-bold text-indigo-700 uppercase mt-0.5 tracking-wider bg-indigo-50 px-2 py-0.5 rounded">{st.role || 'STAFF'}</span>

                <div className="w-full mt-3 flex flex-col gap-1 text-[8px] text-left border-t border-gray-100 pt-2 px-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Department:</span>
                    <span className="font-bold text-gray-800">{st.department || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">ID Ref:</span>
                    <span className="font-bold text-gray-800 uppercase">{st.id.substring(0, 8)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Contact:</span>
                    <span className="font-bold text-gray-800">{st.whatsapp_number || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* QR Code / Footer */}
              <div className="h-12 bg-white flex items-center justify-center relative border-t border-gray-100">
                <div className="bg-white p-1 rounded">
                   <QRCode 
                     value={JSON.stringify({ type: 'staff_attendance', staff_id: st.id })} 
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
