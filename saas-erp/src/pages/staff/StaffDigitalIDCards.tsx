import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Printer, Download, Loader2, Eye, EyeOff, CheckSquare, Square, Shield } from 'lucide-react';
import { cn } from '../../lib/utils';
import { CardTemplate, TemplateId, CardCustomization } from '../../lib/idCardTemplates';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export default function StaffDigitalIDCards() {
  const { userRole } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeFields, setActiveFields] = useState<string[]>([]);
  const [template, setTemplate] = useState<TemplateId>('classic');
  const [customization, setCustomization] = useState<CardCustomization | undefined>(undefined);
  
  // Default to true (school name header removed from card as requested)
  const [hideSchoolHeader, setHideSchoolHeader] = useState<boolean>(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const [exportingCardId, setExportingCardId] = useState<string | null>(null);

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
    const { data } = await supabase.from('staff').select('*').eq('school_id', userRole?.school_id).eq('is_active', true).eq('is_deleted', false).order('role');
    if (data) {
      setStaff(data);
      setSelectedStaff(new Set(data.map(s => s.id)));
    }
    setLoading(false);
  };

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('id_card_settings')
      .select('*')
      .eq('school_id', userRole?.school_id)
      .eq('card_type', 'staff')
      .maybeSingle();

    if (data?.fields) {
      setActiveFields(data.fields);
    } else {
      setActiveFields(['designation', 'department', 'joining_date', 'ref_id']);
    }
    setTemplate((data?.template as TemplateId) ?? 'classic');
    if (data?.layout_config?.customization) setCustomization(data.layout_config.customization);
    if (data?.layout_config?.hideSchoolHeader !== undefined) {
      setHideSchoolHeader(Boolean(data.layout_config.hideSchoolHeader));
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

  const isHorizontal = ['horizon', 'mint'].includes(template);

  // High-Resolution 300 DPI Single Card PNG Exporter
  const downloadSingleCardPNG = async (st: any) => {
    const el = document.getElementById(`staff-card-${st.id}`);
    if (!el) return;
    setExportingCardId(st.id);
    try {
      const canvas = await html2canvas(el, {
        scale: 3.5, // ~300 DPI high resolution
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `Staff_Card_${st.full_name.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('PNG export failed', err);
      alert('Failed to generate high-resolution PNG image.');
    } finally {
      setExportingCardId(null);
    }
  };

  // High-Resolution Batch PNG Exporter
  const downloadAllPNG = async () => {
    const selectedList = staff.filter(s => selectedStaff.has(s.id));
    if (selectedList.length === 0) return;
    setExportingPng(true);
    try {
      for (const st of selectedList) {
        const el = document.getElementById(`staff-card-${st.id}`);
        if (!el) continue;
        const canvas = await html2canvas(el, {
          scale: 3.5,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
        });
        const link = document.createElement('a');
        link.download = `Staff_Card_${st.full_name.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        await new Promise(r => setTimeout(r, 250));
      }
    } catch (err) {
      console.error('Batch PNG export failed', err);
      alert('Failed to export all PNG cards.');
    } finally {
      setExportingPng(false);
    }
  };

  // High-Resolution 300 DPI PDF Exporter (Multi-card Grid on A4)
  const downloadPDF = async () => {
    const selectedList = staff.filter(s => selectedStaff.has(s.id));
    if (selectedList.length === 0) return;
    setExportingPdf(true);
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const cardWidthMm = isHorizontal ? 86 : 54;
      const cardHeightMm = isHorizontal ? 54 : 86;
      const gapX = 8;
      const gapY = 8;
      const marginX = isHorizontal ? 12 : 16;
      const marginY = 16;
      const pageWidth = 210;
      const pageHeight = 297;

      const cardsPerRow = Math.floor((pageWidth - marginX * 2 + gapX) / (cardWidthMm + gapX));
      const cardsPerCol = Math.floor((pageHeight - marginY * 2 + gapY) / (cardHeightMm + gapY));
      const cardsPerPage = Math.max(1, cardsPerRow * cardsPerCol);

      for (let i = 0; i < selectedList.length; i++) {
        const member = selectedList[i];
        const el = document.getElementById(`staff-card-${member.id}`);
        if (!el) continue;

        const indexOnPage = i % cardsPerPage;
        if (i > 0 && indexOnPage === 0) {
          pdf.addPage();
        }

        const col = indexOnPage % cardsPerRow;
        const row = Math.floor(indexOnPage / cardsPerRow);

        const posX = marginX + col * (cardWidthMm + gapX);
        const posY = marginY + row * (cardHeightMm + gapY);

        const canvas = await html2canvas(el, {
          scale: 3.5,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
        });

        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', posX, posY, cardWidthMm, cardHeightMm, undefined, 'FAST');
      }

      pdf.save(`Staff_ID_Cards_300DPI_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('PDF export failed', err);
      alert('Failed to generate high-resolution PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <style>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }
        @media print {
          .no-print { display: none !important; }
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 8mm 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .id-grid {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 8mm !important;
            justify-content: center !important;
            padding: 0 !important;
            background: white !important;
          }
          .id-card-wrapper {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .id-card {
            width: ${isHorizontal ? '86mm' : '54mm'} !important;
            height: ${isHorizontal ? '54mm' : '86mm'} !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
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
        {/* Top Header & Export Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[#0d1526] flex items-center gap-2 tracking-tight uppercase">
              <Shield className="w-7 h-7 text-indigo-600" /> Staff ID Cards
            </h1>
            <p className="text-slate-500 text-sm mt-1 font-medium">Generate high-resolution faculty identification cards (300 DPI CR80 standard).</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* School Header Toggle */}
            <button
              onClick={() => setHideSchoolHeader(!hideSchoolHeader)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all border shadow-sm",
                hideSchoolHeader
                  ? "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
                  : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
              )}
              title="Toggle school name header on cards"
            >
              {hideSchoolHeader ? <EyeOff className="w-4 h-4 text-slate-500" /> : <Eye className="w-4 h-4 text-indigo-600" />}
              {hideSchoolHeader ? 'School Header: Removed' : 'School Header: Visible'}
            </button>

            {/* Download High-Res PNG Button */}
            <button
              onClick={downloadAllPNG}
              disabled={selectedStaff.size === 0 || exportingPng}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md active:scale-95"
              title="Download high-resolution PNG image of cards"
            >
              {exportingPng ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exportingPng ? 'Exporting...' : `Download PNG (${selectedStaff.size})`}
            </button>

            {/* Download High-Res PDF Button */}
            <button
              onClick={downloadPDF}
              disabled={selectedStaff.size === 0 || exportingPdf}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-md active:scale-95"
              title="Download 300 DPI high-resolution PDF for printing"
            >
              {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exportingPdf ? 'Building PDF...' : 'Download PDF'}
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              disabled={selectedStaff.size === 0 || loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0d1526] text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-slate-800 disabled:opacity-50 transition-all shadow-md active:scale-95"
            >
              <Printer className="w-4 h-4" /> Print Cards
            </button>
          </div>
        </div>

        {/* Selection Area */}
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

      {/* Cards Display / Print Layout */}
      <div className={`mt-8 ${selectedStaff.size > 0 ? '' : 'hidden'}`}>
        <div className="flex items-center justify-center gap-2 mb-6 print:hidden">
          <span className="text-[11px] font-black text-[#0d1526] uppercase tracking-[0.25em]">Live Card Layout Preview (High-Definition 300 DPI)</span>
          {hideSchoolHeader && (
            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-bold px-2 py-0.5 rounded-full">School Header Removed</span>
          )}
        </div>
        
        <div className="id-grid flex flex-wrap gap-8 justify-center bg-slate-100 p-12 rounded-[40px] print:p-0 print:bg-white print:gap-[10mm]">
          {staff.filter(s => selectedStaff.has(s.id)).map(st => (
            <div key={st.id} className="id-card-wrapper flex flex-col items-center">
              <div id={`staff-card-${st.id}`} className="id-card shadow-lg bg-white rounded-lg overflow-hidden">
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
                  hideSchoolHeader={hideSchoolHeader}
                />
              </div>

              {/* Single Card PNG Download Button */}
              <div className="mt-2.5 print:hidden">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadSingleCardPNG(st);
                  }}
                  disabled={exportingCardId === st.id}
                  className="flex items-center gap-1 px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-600 rounded-lg text-[10px] font-bold shadow-sm transition-all"
                  title="Download 300 DPI PNG"
                >
                  {exportingCardId === st.id ? (
                    <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                  ) : (
                    <Download className="w-3 h-3 text-indigo-600" />
                  )}
                  Save PNG
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
