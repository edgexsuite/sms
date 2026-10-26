import React from 'react';
import { Mail, Phone, MapPin, Globe } from 'lucide-react';
import { formatDate } from '../lib/utils';
import {
  DEFAULT_APPOINTMENT_TERMS,
  getAppointmentSessionEnd,
  interpolateAppointmentTemplate,
} from '../lib/appointmentLetterTemplate';

interface JoiningLetterProps {
  staff: any;
  schoolInfo: any;
}

export default function JoiningLetter({ staff, schoolInfo }: JoiningLetterProps) {
  if (!staff || !schoolInfo) return null;

  const schoolName = schoolInfo?.name || 'The Edge School';
  const directorName = schoolInfo?.director_name || 'AFTAB AHMAD KHAKWANI';
  const gender = staff?.gender || '';
  const honorific = gender.toLowerCase() === 'female' ? 'Ms./Mrs.' : 'Mr.';
  const effectiveDate = staff.joining_date ? formatDate(staff.joining_date) : formatDate(new Date());
  const refNo = `TES/HR/APP/${staff.id ? String(staff.id).substring(0, 8).toUpperCase() : '________'}`;

  // Use customized terms from Settings if available, otherwise default standard 11 clauses
  const rawTerms = schoolInfo?.recruitment_terms && 
                   schoolInfo.recruitment_terms.trim().length > 100 && 
                   schoolInfo.recruitment_terms.includes('Session Commitment')
    ? schoolInfo.recruitment_terms
    : DEFAULT_APPOINTMENT_TERMS;

  const renderedTerms = interpolateAppointmentTemplate(rawTerms, staff, schoolInfo);

  // Split into Page 1 clauses (1-5) and Page 2 clauses (6-11)
  const allBlocks = renderedTerms.split(/\n\s*\n/).filter(b => b.trim().length > 0);
  const page1Blocks: string[] = [];
  const page2Blocks: string[] = [];

  allBlocks.forEach((block) => {
    const trimmed = block.trim();
    const match = trimmed.match(/^(\d+)\./);
    if (match) {
      const clauseNum = parseInt(match[1], 10);
      if (clauseNum >= 6) {
        page2Blocks.push(block);
      } else {
        page1Blocks.push(block);
      }
    } else {
      if (page2Blocks.length > 0) {
        page2Blocks.push(block);
      } else {
        page1Blocks.push(block);
      }
    }
  });

  const renderClauseList = (blocks: string[]) => (
    <div className="font-body text-[10.5px] leading-[1.48] text-slate-800 space-y-2 text-justify pr-1">
      {blocks.map((block, idx) => {
        const lines = block.split('\n');
        const title = lines[0];
        const isHeading = /^\d+\.\s+/.test(title);
        const bodyLines = isHeading ? lines.slice(1) : lines;

        return (
          <div key={idx} className="contract-clause space-y-0.5">
            {isHeading && (
              <h4 className="font-sans-ui font-black text-slate-900 text-[11px] tracking-tight uppercase border-b border-slate-200 pb-0.5 mb-1">
                {title}
              </h4>
            )}
            <div className="space-y-0.5">
              {bodyLines.map((line, lineIdx) => {
                const trimmed = line.trim();
                if (!trimmed) return null;

                // Sub-bullet (e.g. starts with 'o ' or 'o\t')
                if (/^o[\s\t]+/i.test(trimmed)) {
                  return (
                    <div key={lineIdx} className="flex items-start gap-1.5 pl-5 text-slate-700">
                      <span className="text-[8px] text-slate-400 mt-0.5 shrink-0 select-none">◦</span>
                      <span>{trimmed.replace(/^o[\s\t]+/i, '')}</span>
                    </div>
                  );
                }

                // Primary bullet (e.g. starts with '•' or '* ' or '- ')
                if (/^[•\*\-][\s\t]*/.test(trimmed)) {
                  return (
                    <div key={lineIdx} className="flex items-start gap-1.5 pl-2 text-slate-700">
                      <span className="text-[11px] text-indigo-700 mt-0.5 shrink-0 select-none leading-none">•</span>
                      <span>{trimmed.replace(/^[•\*\-][\s\t]*/, '')}</span>
                    </div>
                  );
                }

                // Regular descriptive line (e.g. intro text in clause 5, 6, 9)
                return (
                  <p key={lineIdx} className="text-slate-700 pl-0.5">
                    {trimmed}
                  </p>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="appointment-doc-wrapper w-full flex flex-col items-center">
      <link
        href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Inter:wght@400;500;600;700;800;900&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400&display=swap"
        rel="stylesheet"
      />
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 14mm 8mm 14mm;
          }
          body, #root {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: white !important;
          }
          /* Suppress all external and layout headers */
          .global-print-header,
          .no-print {
            display: none !important;
          }
          .appointment-doc-wrapper {
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            box-shadow: none !important;
          }
          .appointment-page {
            box-shadow: none !important;
            border: none !important;
            padding: 2mm 4mm !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
            box-sizing: border-box !important;
            min-height: auto !important;
            height: auto !important;
            page-break-after: always !important;
            break-after: page !important;
          }
          .appointment-page-2 {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .contract-clause {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .page-break-avoid {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
        @media screen {
          .appointment-page {
            border: 1px solid #cbd5e1;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
            margin-bottom: 2rem;
            padding: 2rem 2.25rem;
            box-sizing: border-box;
            width: 100%;
            max-width: 210mm;
          }
        }
        .font-cinzel { font-family: 'Cinzel', serif; }
        .font-body { font-family: 'Merriweather', Georgia, serif; }
        .font-sans-ui { font-family: 'Inter', sans-serif; }
      `}</style>

      {/* ══════════════════════════════════════════════════════════
          PAGE 1 (Header, Addressee, Preamble, Clauses 1 to 5)
          ══════════════════════════════════════════════════════════ */}
      <div className="appointment-page appointment-page-1 bg-white w-full max-w-[210mm] text-[#0f172a] relative font-sans box-border flex flex-col justify-between">
        <div>
          {/* ── Official Letterhead Header (Properly bounded, no overflow) ── */}
          <div className="flex w-full items-start justify-between gap-3 border-b-2 border-slate-900 pb-3 mb-3.5 relative z-10">
            {/* Left Branding Block */}
            <div className="flex gap-3.5 items-center flex-1 min-w-0 pr-2">
              {schoolInfo?.logo_url && (
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-xl flex items-center justify-center p-1 border border-slate-200 shadow-sm shrink-0">
                  <img src={schoolInfo.logo_url} alt="School Logo" className="max-w-full max-h-full object-contain" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl font-black uppercase text-slate-900 tracking-tight leading-tight mb-1 font-cinzel truncate">
                  {schoolName}
                </h1>
                <p className="text-[9px] font-black text-indigo-700 uppercase tracking-wider mb-1 font-sans-ui">
                  Excellence in Quality Education & Character Building
                </p>
                <div className="space-y-0.5 text-[8.5px] font-sans-ui font-medium text-slate-600">
                  <p className="flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-indigo-700 shrink-0" />
                    <span className="truncate">{schoolInfo?.address || 'Main Campus, Pakistan'}</span>
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {schoolInfo?.contact_phone && (
                      <p className="flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5 text-indigo-700 shrink-0" />
                        <span>{schoolInfo.contact_phone}</span>
                      </p>
                    )}
                    {schoolInfo?.website && (
                      <p className="flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5 text-indigo-700 shrink-0" />
                        <span>{schoolInfo.website}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Document Title, Ref, and Date (Right side with guaranteed safety margin) */}
            <div className="text-right shrink-0 pr-1 sm:pr-2">
              <h2 className="text-xs sm:text-sm font-black tracking-wider uppercase font-sans-ui text-slate-900 border-b-2 border-slate-900 pb-0.5 mb-1 inline-block text-right whitespace-nowrap">
                APPOINTMENT LETTER
              </h2>
              <div className="space-y-0.5 text-right text-[10px] sm:text-[10.5px] font-sans-ui text-slate-800">
                <p className="font-bold whitespace-nowrap">
                  Ref: <span className="font-mono font-semibold text-slate-900">{refNo}</span>
                </p>
                <p className="font-bold whitespace-nowrap">
                  Date: <span className="font-semibold text-slate-900">{formatDate(new Date())}</span>
                </p>
              </div>
            </div>
          </div>

          {/* ── Addressee Details Card (Fetched from Profile & System) ── */}
          <div className="mb-3.5 p-3 bg-slate-50 border border-slate-200 rounded-xl font-sans-ui text-xs space-y-1">
            <p className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest">To,</p>
            <div className="flex flex-wrap items-baseline justify-between gap-2 pr-1">
              <p className="text-sm font-black text-slate-900">
                {honorific} {staff.full_name}
              </p>
              {staff.role && (
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {staff.role}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 pt-1 text-slate-700 font-medium text-[10px] pr-1">
              {staff.father_name && (
                <p>
                  <strong className="text-slate-900 font-bold">{staff.gender?.toLowerCase() === 'female' ? 'S/O, D/O, W/O:' : 'S/O:'}</strong> {staff.father_name}
                </p>
              )}
              <p>
                <strong className="text-slate-900 font-bold">CNIC:</strong> {staff.cnic || '________________________'}
              </p>
              <p>
                <strong className="text-slate-900 font-bold">Contact:</strong> {staff.mobile_number || staff.whatsapp_number || '________________________'}
              </p>
              {staff.qualification && (
                <p>
                  <strong className="text-slate-900 font-bold">Qualification:</strong> {staff.qualification}
                </p>
              )}
              {staff.department && (
                <p>
                  <strong className="text-slate-900 font-bold">Department:</strong> {staff.department}
                </p>
              )}
              <p>
                <strong className="text-slate-900 font-bold">Effective Date:</strong> {effectiveDate}
              </p>
              {staff.address && (
                <p className="sm:col-span-2 md:col-span-3">
                  <strong className="text-slate-900 font-bold">Address:</strong> {staff.address}
                </p>
              )}
            </div>
          </div>

          {/* ── Preamble ── */}
          <div className="font-body text-[11px] leading-[1.55] text-slate-800 mb-3 text-justify pr-1">
            <p>
              We are pleased to appoint you as <strong className="font-black text-slate-900 underline decoration-indigo-400 decoration-2 underline-offset-2">{staff.role || 'Montessori School Teacher'}</strong> at <strong className="font-bold text-slate-900">{schoolName}</strong>, effective from <strong className="font-bold text-slate-900">{effectiveDate}</strong>. This appointment is governed by the following terms and conditions:
            </p>
          </div>

          {/* ── Page 1 Clauses (1 to 5) ── */}
          {renderClauseList(page1Blocks)}
        </div>

        {/* ── Page 1 Running Footer ── */}
        <div className="mt-4 pt-2 border-t border-slate-200 flex justify-between items-center text-[8.5px] font-sans-ui text-slate-400 pr-1">
          <p>{schoolName} — Appointment Contract</p>
          <p className="font-mono font-bold tracking-wider">{refNo} • Page 1 of 2</p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          PAGE 2 (Continuation Header, Clauses 6 to 11, Signatures)
          ══════════════════════════════════════════════════════════ */}
      <div className="appointment-page appointment-page-2 bg-white w-full max-w-[210mm] text-[#0f172a] relative font-sans box-border flex flex-col justify-between">
        <div>
          {/* ── Page 2 Continuation Header (Comfortable width, guaranteed no right clipping) ── */}
          <div className="flex w-full items-center justify-between border-b border-slate-300 pb-2 mb-3.5 text-[9.5px] font-sans-ui text-slate-600">
            <div className="flex items-center gap-2 min-w-0 flex-1 pr-3 truncate">
              {schoolInfo?.logo_url && (
                <img src={schoolInfo.logo_url} alt="Logo" className="w-4 h-4 object-contain shrink-0" />
              )}
              <span className="font-bold text-slate-900 uppercase tracking-wider truncate">{schoolName}</span>
              <span className="text-slate-400 shrink-0">•</span>
              <span className="font-medium text-slate-500 shrink-0">Appointment Letter (Continued)</span>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 text-right pr-1 sm:pr-2 whitespace-nowrap">
              <span>Ref: <strong className="text-slate-900 font-mono">{refNo}</strong></span>
              <span className="text-slate-400">•</span>
              <span className="font-bold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">Page 2 of 2</span>
            </div>
          </div>

          {/* ── Page 2 Clauses (6 to 11) ── */}
          {renderClauseList(page2Blocks)}

          {/* ── Welcoming Note ── */}
          <div className="font-body text-[11px] italic font-semibold text-slate-900 border-t border-slate-200 pt-2 mt-2.5 mb-2.5 pr-1">
            We welcome you to {schoolName} and look forward to your valuable contribution.
          </div>

          {/* ── Dual Acceptance & Director Signature Blocks ── */}
          <div className="page-break-avoid grid grid-cols-1 sm:grid-cols-2 gap-4 border-t-2 border-slate-900 pt-2.5 mt-1 font-sans-ui pr-1">
            {/* Left: Employee Acceptance */}
            <div className="bg-slate-50/70 p-2.5 rounded-lg border border-slate-200 text-xs space-y-1.5">
              <p className="font-black text-slate-900 uppercase tracking-wider text-[10px] border-b border-slate-200 pb-0.5">
                Employee Acceptance
              </p>
              <p className="text-[9.5px] text-slate-600 font-medium italic">
                I, <span className="font-bold text-slate-900 underline">{staff.full_name}</span>, hereby accept the appointment under the terms and conditions stated above.
              </p>
              <div className="pt-1 space-y-1 text-slate-700 text-[9.5px]">
                <p><span className="font-bold">Signature:</span> __________________________________</p>
                <p><span className="font-bold">Name:</span> <span className="font-semibold text-slate-900">{staff.full_name}</span></p>
                <p><span className="font-bold">CNIC:</span> <span className="font-mono">{staff.cnic || '________________________'}</span></p>
                <p><span className="font-bold">Date:</span> __________________________________</p>
              </div>
            </div>

            {/* Right: Director / Management Authorization */}
            <div className="bg-indigo-50/40 p-2.5 rounded-lg border border-indigo-200 text-xs space-y-1.5">
              <p className="font-black text-indigo-950 uppercase tracking-wider text-[10px] border-b border-indigo-200 pb-0.5">
                Director / Issuing Authority
              </p>
              <p className="text-[9.5px] text-indigo-900 font-medium">
                For and on behalf of <span className="font-bold">{schoolName}</span>:
              </p>
              <div className="pt-1 space-y-1 text-slate-800 text-[9.5px]">
                <p><span className="font-bold">Signature:</span> __________________________________</p>
                <p><span className="font-bold">Name:</span> <span className="font-semibold text-indigo-950">{directorName}</span></p>
                <p><span className="font-bold">Designation:</span> <span className="font-semibold text-slate-900">Director</span></p>
                <p><span className="font-bold">Date:</span> <span className="font-semibold">{formatDate(new Date())}</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Page 2 Official Footer ── */}
        <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center text-[8.5px] font-sans-ui text-slate-400 pr-1">
          <p>This is a legally binding appointment document issued by {schoolName}.</p>
          <p className="font-mono font-bold tracking-wider">{refNo} • Page 2 of 2</p>
        </div>
      </div>
    </div>
  );
}
