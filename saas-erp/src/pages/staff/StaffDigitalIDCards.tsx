import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Printer, Download, Loader2, Eye, EyeOff, CheckSquare, Square, 
  Shield, Search, Ban, X 
} from 'lucide-react';
import { cn, getBase64Image } from '../../lib/utils';
import { CardTemplate, TemplateId, CardCustomization } from '../../lib/idCardTemplates';
import { StaffCategory, getStaffCategory, STAFF_CATEGORIES } from '../../lib/staffUtils';
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
  
  // Categorization & Exclusion states
  const [categoryFilter, setCategoryFilter] = useState<'all' | StaffCategory>('all');
  const [excludedCategory, setExcludedCategory] = useState<StaffCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  const handleToggleExcludeCategory = (cat: StaffCategory | null) => {
    if (cat === null || excludedCategory === cat) {
      setExcludedCategory(null);
    } else {
      setExcludedCategory(cat);
      // Automatically deselect all staff in the excluded category
      setSelectedStaff(prev => {
        const next = new Set(prev);
        staff.forEach(s => {
          if (getStaffCategory(s) === cat) {
            next.delete(s.id);
          }
        });
        return next;
      });
    }
  };

  // Eligible staff members taking exclusions into account
  const eligibleStaff = staff.filter(s => (excludedCategory ? getStaffCategory(s) !== excludedCategory : true));
  const activePrintableStaff = eligibleStaff.filter(s => selectedStaff.has(s.id));

  const toggleStaff = (id: string) => {
    const newSet = new Set(selectedStaff);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedStaff(newSet);
  };

  const toggleAll = () => {
    const allEligibleSelected = eligibleStaff.length > 0 && eligibleStaff.every(s => selectedStaff.has(s.id));
    if (allEligibleSelected) {
      setSelectedStaff(new Set());
    } else {
      setSelectedStaff(new Set(eligibleStaff.map(s => s.id)));
    }
  };

  // Category counts
  const counts = {
    all: staff.length,
    teaching: staff.filter(s => getStaffCategory(s) === 'teaching').length,
    non_teaching: staff.filter(s => getStaffCategory(s) === 'non_teaching').length,
    admin: staff.filter(s => getStaffCategory(s) === 'admin').length,
  };

  // Visible staff in list filtered by tab and search
  const visibleStaff = staff.filter(s => {
    const cat = getStaffCategory(s);
    if (categoryFilter !== 'all' && cat !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match = (s.full_name || '').toLowerCase().includes(q) ||
                    (s.role || '').toLowerCase().includes(q) ||
                    (s.department || '').toLowerCase().includes(q) ||
                    (s.designation || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

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
    const selectedList = activePrintableStaff;
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
    const selectedList = activePrintableStaff;
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
              disabled={activePrintableStaff.length === 0 || exportingPng}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md active:scale-95"
              title="Download high-resolution PNG image of cards"
            >
              {exportingPng ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exportingPng ? 'Exporting...' : `Download PNG (${activePrintableStaff.length})`}
            </button>

            {/* Download Vector PDF Button (Unflattened) */}
            <button
              onClick={downloadVectorPDF}
              disabled={activePrintableStaff.length === 0 || exportingPdf}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-md active:scale-95"
              title="Download unflattened vectorized PDF with selectable vector text"
            >
              {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exportingPdf ? 'Building Vector PDF...' : `Vector PDF (${activePrintableStaff.length})`}
            </button>

            {/* Print / Save as Vector PDF Button */}
            <button
              onClick={handlePrint}
              disabled={activePrintableStaff.length === 0 || loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0d1526] text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-slate-800 disabled:opacity-50 transition-all shadow-md active:scale-95"
              title="Print directly or choose 'Save as PDF' in print dialog for 100% vector output"
            >
              <Printer className="w-4 h-4" /> Print Cards ({activePrintableStaff.length})
            </button>
          </div>
        </div>

        {/* Categorization, Exclusion & Selection Area */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-6 space-y-4">
           {/* Top Bar: Category Filter Tabs & Exclude Category Control */}
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
             {/* Category Filter Tabs */}
             <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/60 overflow-x-auto">
               <button
                 type="button"
                 onClick={() => setCategoryFilter('all')}
                 className={cn(
                   "px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap",
                   categoryFilter === 'all'
                     ? "bg-white text-slate-900 shadow-sm"
                     : "text-slate-500 hover:text-slate-900"
                 )}
               >
                 All <span className="ml-1 text-[10px] font-bold opacity-70">({counts.all})</span>
               </button>
               {STAFF_CATEGORIES.map(cat => {
                 const isExcluded = excludedCategory === cat.id;
                 const count = cat.id === 'teaching' ? counts.teaching : cat.id === 'non_teaching' ? counts.non_teaching : counts.admin;
                 return (
                   <button
                     key={cat.id}
                     type="button"
                     onClick={() => setCategoryFilter(cat.id)}
                     className={cn(
                       "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap",
                       categoryFilter === cat.id
                         ? "bg-white text-indigo-600 shadow-sm"
                         : "text-slate-500 hover:text-slate-900",
                       isExcluded && "opacity-60 line-through decoration-rose-500 decoration-2"
                     )}
                   >
                     {cat.label}
                     <span className={cn(
                       "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                       isExcluded ? "bg-rose-100 text-rose-700" : "bg-slate-200/70 text-slate-700"
                     )}>
                       {count}
                     </span>
                     {isExcluded && <span className="text-[9px] font-black text-rose-600 no-underline">EXCL</span>}
                   </button>
                 );
               })}
             </div>

             {/* Exclude Category Control */}
             <div className="flex items-center gap-2">
               <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                 <Ban className="w-3.5 h-3.5 text-rose-500" /> Exclude:
               </span>
               <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200/60 gap-1">
                 <button
                   type="button"
                   onClick={() => handleToggleExcludeCategory(null)}
                   className={cn(
                     "px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all",
                     excludedCategory === null
                       ? "bg-white text-slate-800 shadow-sm"
                       : "text-slate-500 hover:text-slate-800"
                   )}
                 >
                   None
                 </button>
                 {STAFF_CATEGORIES.map(cat => (
                   <button
                     key={cat.id}
                     type="button"
                     onClick={() => handleToggleExcludeCategory(cat.id)}
                     className={cn(
                       "px-2.5 py-1 text-[11px] font-black rounded-lg transition-all",
                       excludedCategory === cat.id
                         ? "bg-rose-600 text-white shadow-sm"
                         : "text-slate-500 hover:text-rose-600"
                     )}
                     title={`Exclude all ${cat.label} staff from printing and PDF/PNG export`}
                   >
                     {cat.label}
                   </button>
                 ))}
               </div>
             </div>
           </div>

           {/* Active Exclusion Notice Banner */}
           {excludedCategory && (
             <div className="flex items-center justify-between px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs">
               <div className="flex items-center gap-2 text-rose-800 font-bold">
                 <Ban className="w-4 h-4 text-rose-600 shrink-0" />
                 <span>
                   <strong className="font-black uppercase tracking-tight">{STAFF_CATEGORIES.find(c => c.id === excludedCategory)?.label} Staff</strong> are excluded ({counts[excludedCategory]} personnel). They are omitted from print layout, Vector PDF, and PNG downloads.
                 </span>
               </div>
               <button
                 type="button"
                 onClick={() => handleToggleExcludeCategory(null)}
                 className="flex items-center gap-1 text-[11px] font-black uppercase text-rose-700 hover:text-rose-900 bg-rose-100/80 px-2.5 py-1 rounded-lg transition-colors ml-2"
               >
                 <X className="w-3.5 h-3.5" /> Clear Exclusion
               </button>
             </div>
           )}

           {/* Search & Bulk Toggle Row */}
           <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
              <div className="flex items-center gap-3">
                <button 
                  onClick={toggleAll} 
                  className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 border border-slate-200 transition-colors"
                  title="Toggle select all eligible staff"
                >
                  {eligibleStaff.length > 0 && eligibleStaff.every(s => selectedStaff.has(s.id)) ? (
                    <CheckSquare className="w-5 h-5 text-indigo-600" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                </button>
                <div>
                  <span className="text-xs font-black text-slate-800 uppercase tracking-tight">Select Faculty Members</span>
                  <p className="text-[10px] text-slate-400 font-bold">
                    Showing {visibleStaff.length} of {staff.length} staff
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by name, role..."
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all w-48 sm:w-64"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100 px-3 py-1.5 rounded-full uppercase tracking-widest whitespace-nowrap">
                  {activePrintableStaff.length} Selected
                </span>
              </div>
           </div>

           {/* Staff List Grid */}
           <div className="max-h-72 overflow-y-auto pr-2 custom-scrollbar grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {loading ? (
                <div className="col-span-full py-20 flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading staff database...</p>
                </div>
              ) : visibleStaff.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-400 text-xs font-bold">
                  No staff members match the current filter or search criteria.
                </div>
              ) : visibleStaff.map(s => {
                const cat = getStaffCategory(s);
                const isCatExcluded = excludedCategory === cat;
                const isSelected = selectedStaff.has(s.id) && !isCatExcluded;
                const catMeta = STAFF_CATEGORIES.find(c => c.id === cat);

                return (
                  <div 
                    key={s.id} 
                    className={cn(
                      "flex items-center justify-between gap-3 py-2.5 px-3.5 border rounded-2xl transition-all group",
                      isCatExcluded 
                        ? "bg-slate-50/70 border-slate-200 opacity-60 cursor-not-allowed"
                        : isSelected 
                          ? "bg-indigo-50/80 border-indigo-200 cursor-pointer shadow-sm" 
                          : "bg-white border-slate-100 hover:border-slate-200 cursor-pointer"
                    )} 
                    onClick={() => {
                      if (!isCatExcluded) toggleStaff(s.id);
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "w-5 h-5 rounded-md flex items-center justify-center transition-all shrink-0",
                        isCatExcluded
                          ? "bg-slate-200 text-slate-400"
                          : isSelected 
                            ? "bg-indigo-600 text-white" 
                            : "bg-slate-100 text-slate-300 group-hover:bg-slate-200"
                      )}>
                        {isSelected ? <CheckSquare className="w-4 h-4" /> : isCatExcluded ? <Ban className="w-3.5 h-3.5 text-slate-400" /> : null}
                      </div>
                      <div className="min-w-0">
                        <p className={cn(
                          "text-xs font-black uppercase tracking-tight truncate", 
                          isCatExcluded 
                            ? "text-slate-400 line-through" 
                            : isSelected ? "text-indigo-900" : "text-slate-700 font-bold"
                        )}>
                          {s.full_name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">
                          {s.role || 'Staff'} {s.department ? `• ${s.department}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Category Badge */}
                    <div className="shrink-0">
                      {isCatExcluded ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                          Excluded
                        </span>
                      ) : (
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                          catMeta?.badgeClass || "bg-slate-100 text-slate-700 border-slate-200"
                        )}>
                          {catMeta?.label || cat}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
           </div>
        </div>
      </div>

      {/* Cards Display / Print Layout */}
      <div className={`mt-8 ${activePrintableStaff.length > 0 ? '' : 'hidden'}`}>
        <div className="flex items-center justify-center gap-2 mb-6 print:hidden">
          <span className="text-[11px] font-black text-[#0d1526] uppercase tracking-[0.25em]">
            Live Card Layout Preview ({activePrintableStaff.length} Cards • 300 DPI)
          </span>
        </div>
        
        <div className="id-grid flex flex-wrap gap-8 justify-center bg-slate-100 p-12 rounded-[40px] print:p-0 print:bg-white print:gap-[10mm]">
          {activePrintableStaff.map(st => (
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
