import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Printer, Download, Loader2, Eye, EyeOff, CheckSquare, Square, Shield } from 'lucide-react';
import { cn, getBase64Image } from '../../lib/utils';
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
  
  // School header stays on the card (default: false, school header is visible on card)
  const [hideSchoolHeader, setHideSchoolHeader] = useState<boolean>(false);
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

  // Helper to convert SVG element to a clean PNG data URL for embedding in PDF
  const svgToPngDataUrl = (svgEl: SVGSVGElement): Promise<string> => {
    return new Promise((resolve) => {
      try {
        const xml = new XMLSerializer().serializeToString(svgEl);
        const svg64 = btoa(unescape(encodeURIComponent(xml)));
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 400;
          canvas.height = 400;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 400, 400);
            ctx.drawImage(img, 0, 0, 400, 400);
            resolve(canvas.toDataURL('image/png'));
          } else {
            resolve('');
          }
        };
        img.onerror = () => resolve('');
        img.src = 'data:image/svg+xml;base64,' + svg64;
      } catch {
        resolve('');
      }
    });
  };

  // Helper to fetch image as Base64 safely
  const fetchImageBase64 = async (url: string | null): Promise<string | null> => {
    if (!url) return null;
    try {
      return await getBase64Image(url);
    } catch {
      return null;
    }
  };

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

  // True Vector PDF Exporter (Unflattened, Selectable Vector Text & Vector Shapes)
  const downloadVectorPDF = async () => {
    const selectedList = staff.filter(s => selectedStaff.has(s.id));
    if (selectedList.length === 0) return;
    setExportingPdf(true);
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const schoolLogoBase64 = schoolInfo?.logo_url ? await fetchImageBase64(schoolInfo.logo_url) : null;
      const schoolName = (schoolInfo?.name || 'THE EDGE SCHOOL').toUpperCase();

      const cardW = 54;
      const cardH = 86;
      const gapX = 8;
      const gapY = 8;
      const marginX = 16;
      const marginY = 14;
      const cardsPerRow = 3;
      const cardsPerCol = 3;
      const cardsPerPage = cardsPerRow * cardsPerCol;

      const primaryHex = customization?.primaryColor || '#1d4ed8';
      const roleBgHex = customization?.roleBgColor || '#eff6ff';
      const roleTextHex = customization?.roleColor || '#1d4ed8';

      for (let i = 0; i < selectedList.length; i++) {
        const st = selectedList[i];
        const cardEl = document.getElementById(`staff-card-${st.id}`);

        const indexOnPage = i % cardsPerPage;
        if (i > 0 && indexOnPage === 0) {
          pdf.addPage();
        }

        const col = indexOnPage % cardsPerRow;
        const row = Math.floor(indexOnPage / cardsPerRow);

        const x = marginX + col * (cardW + gapX);
        const y = marginY + row * (cardH + gapY);

        // 1. Vector Card Background & Border
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.35);
        pdf.roundedRect(x, y, cardW, cardH, 2.5, 2.5, 'FD');

        // 2. Vector School Header (Top Blue Banner)
        if (!hideSchoolHeader) {
          pdf.setFillColor(primaryHex);
          pdf.roundedRect(x, y, cardW, 20, 2.5, 2.5, 'F');
          pdf.rect(x, y + 10, cardW, 10, 'F');

          // School Logo
          if (schoolLogoBase64) {
            try {
              pdf.addImage(schoolLogoBase64, 'PNG', x + 23.5, y + 2.2, 7, 7);
            } catch {}
          }

          // Vector School Name Text
          pdf.setTextColor(255, 255, 255);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(7.5);
          pdf.text(schoolName, x + 27, y + 12.5, { align: 'center', maxWidth: 48 });

          // Vector Subtitle Text
          pdf.setTextColor(191, 219, 254);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(4.5);
          pdf.text('FACULTY IDENTITY CARD', x + 27, y + 16.5, { align: 'center' });
        } else {
          pdf.setFillColor(primaryHex);
          pdf.rect(x, y, cardW, 2, 'F');
        }

        // 3. Photo Circle
        const photoY = hideSchoolHeader ? y + 8 : y + 13;
        const photoBase64 = st.photograph_url ? await fetchImageBase64(st.photograph_url) : null;

        if (photoBase64) {
          try {
            pdf.addImage(photoBase64, 'JPEG', x + 18, photoY, 18, 18);
          } catch {}
        } else {
          pdf.setFillColor(226, 232, 240);
          pdf.circle(x + 27, photoY + 9, 9, 'F');
          pdf.setTextColor(148, 163, 184);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(10);
          pdf.text(st.full_name.charAt(0).toUpperCase(), x + 27, photoY + 12.5, { align: 'center' });
        }

        // White border ring around photo
        pdf.setDrawColor(255, 255, 255);
        pdf.setLineWidth(0.9);
        pdf.circle(x + 27, photoY + 9, 9, 'S');

        // 4. Vector Staff Name
        const nameY = hideSchoolHeader ? y + 31 : y + 36;
        pdf.setTextColor(15, 23, 42);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9.5);
        pdf.text(st.full_name.toUpperCase(), x + 27, nameY, { align: 'center', maxWidth: 48 });

        // 5. Vector Role / Designation Badge (Centered in Pill)
        const roleText = (st.role || 'TEACHER').toUpperCase();
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(6);
        const textW = pdf.getTextWidth(roleText);
        const pillW = Math.max(18, textW + 8);
        const pillH = 4.8;
        const pillX = x + 27 - pillW / 2;
        const pillY = nameY + 2.5;

        pdf.setFillColor(roleBgHex);
        pdf.roundedRect(pillX, pillY, pillW, pillH, 2.4, 2.4, 'F');

        pdf.setTextColor(roleTextHex);
        pdf.text(roleText, x + 27, pillY + 3.3, { align: 'center' });

        // 6. Vector Details Fields
        let fieldY = pillY + 8.5;
        pdf.setDrawColor(241, 245, 249);
        pdf.setLineWidth(0.25);
        pdf.line(x + 8, fieldY - 2, x + 46, fieldY - 2);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(5.8);

        if (activeFields.includes('designation') && st.designation && st.designation.toLowerCase() !== st.role?.toLowerCase()) {
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(51, 65, 85);
          pdf.text(st.designation.toUpperCase(), x + 27, fieldY, { align: 'center', maxWidth: 46 });
          fieldY += 3.6;
        }

        if (activeFields.includes('department') && st.department) {
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100, 116, 139);
          pdf.text(st.department.toUpperCase(), x + 27, fieldY, { align: 'center', maxWidth: 46 });
          fieldY += 3.6;
        }

        if (activeFields.includes('joining_date') && st.joining_date) {
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(148, 163, 184);
          pdf.text(`Since ${st.joining_date}`, x + 27, fieldY, { align: 'center' });
          fieldY += 3.6;
        }

        if (activeFields.includes('ref_id')) {
          pdf.setFont('courier', 'normal');
          pdf.setTextColor(180, 195, 215);
          pdf.setFontSize(5.5);
          pdf.text(st.id.substring(0, 8).toUpperCase(), x + 27, fieldY, { align: 'center' });
        }

        // 7. QR Code
        const qrSvg = cardEl?.querySelector('svg');
        if (qrSvg) {
          const qrDataUrl = await svgToPngDataUrl(qrSvg as SVGSVGElement);
          if (qrDataUrl) {
            pdf.setFillColor(255, 255, 255);
            pdf.setDrawColor(226, 232, 240);
            pdf.setLineWidth(0.2);
            pdf.roundedRect(x + 19, y + 66, 16, 16, 1.5, 1.5, 'FD');
            pdf.addImage(qrDataUrl, 'PNG', x + 19.5, y + 66.5, 15, 15);
          }
        }
      }

      pdf.save(`Staff_ID_Cards_Vector_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('Vector PDF export failed', err);
      alert('Failed to generate Vector PDF.');
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
          .no-print, header, nav, aside, .print\\:hidden {
            display: none !important;
          }
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
              {hideSchoolHeader ? 'Card Header: Hidden' : 'Card Header: Visible'}
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

            {/* Download Vector PDF Button (Unflattened) */}
            <button
              onClick={downloadVectorPDF}
              disabled={selectedStaff.size === 0 || exportingPdf}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-md active:scale-95"
              title="Download unflattened vectorized PDF with selectable vector text"
            >
              {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exportingPdf ? 'Building Vector PDF...' : 'Vector PDF'}
            </button>

            {/* Print / Save as Vector PDF Button */}
            <button
              onClick={handlePrint}
              disabled={selectedStaff.size === 0 || loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0d1526] text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-slate-800 disabled:opacity-50 transition-all shadow-md active:scale-95"
              title="Print directly or choose 'Save as PDF' in print dialog for 100% vector output"
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
